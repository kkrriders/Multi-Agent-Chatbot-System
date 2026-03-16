const express = require('express');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const Conversation = require('../models/Conversation');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../shared/logger');
const { summarizeConversation, SUMMARIZE_THRESHOLD } = require('../shared/summarizer');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_STATUSES = ['active', 'archived', 'deleted'];
const VALID_AGENT_TYPES = ['manager', 'agent-1', 'agent-2', 'agent-3', 'agent-4'];
const VALID_ROLES = ['user', 'assistant', 'system'];

// ─── Validators ───────────────────────────────────────────────────────────────

function validateObjectId(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return 'Invalid ID format';
  }
  // Reject 12-byte strings that happen to pass isValid but aren't 24-hex ObjectIds
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return 'Invalid ID format';
  }
  return null;
}

function validateListQuery({ status, limit }) {
  if (status && !VALID_STATUSES.includes(status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (limit !== undefined) {
    const n = parseInt(limit, 10);
    if (isNaN(n) || n < 1 || n > 100) {
      return 'limit must be an integer between 1 and 100';
    }
  }
  return null;
}

function validateCreateConversation({ title, agentType }) {
  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
      return 'title must be a non-empty string with max 200 characters';
    }
  }
  if (agentType !== undefined && !VALID_AGENT_TYPES.includes(agentType)) {
    return `agentType must be one of: ${VALID_AGENT_TYPES.join(', ')}`;
  }
  return null;
}

function validateAddMessage({ role, content, agentId }) {
  if (!role || !content) {
    return 'role and content are required';
  }
  if (!VALID_ROLES.includes(role)) {
    return `role must be one of: ${VALID_ROLES.join(', ')}`;
  }
  // Type check before length check (prevents object/array bypass)
  if (typeof content !== 'string') {
    return 'content must be a string';
  }
  if (content.length < 1 || content.length > 10000) {
    return 'content must be between 1 and 10,000 characters';
  }
  if (agentId !== undefined && (typeof agentId !== 'string' || agentId.length > 50)) {
    return 'agentId must be a string with max 50 characters';
  }
  return null;
}

function validateUpdateConversation({ title, status, tags, summary }) {
  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0 || title.length > 200)) {
    return 'title must be a non-empty string with max 200 characters';
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.some(t => typeof t !== 'string' || t.trim().length === 0 || t.length > 50)) {
      return 'tags must be an array of non-empty strings (max 50 chars each)';
    }
  }
  if (summary !== undefined && (typeof summary !== 'string' || summary.length > 5000)) {
    return 'summary must be a string with max 5,000 characters';
  }
  return null;
}

function validateTags({ tags }) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return 'at least one tag is required';
  }
  if (tags.some(t => typeof t !== 'string' || t.trim().length === 0 || t.length > 50)) {
    return 'tags must be non-empty strings with max 50 characters each';
  }
  return null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
// IMPORTANT: static-path routes (/tags/all, /search/by-tags) MUST be registered
// BEFORE the parameterised /:id route, otherwise Express matches them as IDs.

/**
 * @route   GET /api/conversations
 * @desc    Get all conversations for the logged-in user
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const { status = 'active', limit = 50 } = req.query;

    const queryError = validateListQuery({ status, limit });
    if (queryError) {
      return res.status(400).json({ success: false, error: queryError });
    }

    const conversations = await Conversation.getUserConversations(
      req.user._id,
      status,
      parseInt(limit, 10)
    );

    res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations,
    });
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({ success: false, error: 'Error fetching conversations' });
  }
});

/**
 * @route   GET /api/conversations/tags/all
 * @desc    Get all unique tags for the user with counts
 * @access  Private
 * NOTE: Must be registered before /:id to avoid route shadowing.
 */
router.get('/tags/all', async (req, res) => {
  try {
    const tags = await Conversation.getUserTags(req.user._id);

    res.status(200).json({
      success: true,
      count: tags.length,
      data: tags,
    });
  } catch (error) {
    logger.error('Get tags error:', error);
    res.status(500).json({ success: false, error: 'Error fetching tags' });
  }
});

/**
 * @route   GET /api/conversations/search/by-tags
 * @desc    Search conversations by tags
 * @access  Private
 * NOTE: Must be registered before /:id to avoid route shadowing.
 */
router.get('/search/by-tags', async (req, res) => {
  try {
    const { tags, status = 'active' } = req.query;

    if (!tags) {
      return res.status(400).json({ success: false, error: 'tags parameter is required' });
    }

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }

    const searchTags = Array.isArray(tags) ? tags : tags.split(',');
    const conversations = await Conversation.findByTags(req.user._id, searchTags, status);

    res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations,
    });
  } catch (error) {
    logger.error('Search by tags error:', error);
    res.status(500).json({ success: false, error: 'Error searching conversations' });
  }
});

/**
 * @route   POST /api/conversations
 * @desc    Create a new conversation
 * @access  Private
 */
router.post('/', async (req, res) => {
  try {
    const { title, agentType } = req.body;

    const createError = validateCreateConversation({ title, agentType });
    if (createError) {
      return res.status(400).json({ success: false, error: createError });
    }

    const conversation = await Conversation.create({
      userId: req.user._id,
      title: title?.trim() || 'New Conversation',
      agentType: agentType || 'manager',
      messages: [],
    });

    logger.info(`New conversation created for user: ${req.user.email}`);

    res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    logger.error('Create conversation error:', error);
    res.status(500).json({ success: false, error: 'Error creating conversation' });
  }
});

/**
 * @route   GET /api/conversations/:id/usage
 * @desc    Token usage stats for a conversation (input/output per model)
 * @access  Private
 * NOTE: Registered before /:id to avoid route shadowing.
 */
router.get('/:id/usage', async (req, res) => {
  try {
    const idError = validateObjectId(req.params.id);
    if (idError) {
      return res.status(400).json({ success: false, error: idError });
    }

    const conversation = await Conversation.findOne(
      { _id: req.params.id, userId: req.user._id },
      'messages.role messages.metadata.model messages.tokenUsage'
    ).lean();

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    let totalInput = 0;
    let totalOutput = 0;
    const byModel = {};

    for (const msg of conversation.messages) {
      const usage = msg.tokenUsage;
      if (!usage) continue;
      const input  = usage.inputTokens  || 0;
      const output = usage.outputTokens || 0;
      totalInput  += input;
      totalOutput += output;

      const modelKey = msg.metadata?.model || 'unknown';
      if (!byModel[modelKey]) byModel[modelKey] = { inputTokens: 0, outputTokens: 0, calls: 0 };
      byModel[modelKey].inputTokens  += input;
      byModel[modelKey].outputTokens += output;
      byModel[modelKey].calls++;
    }

    res.status(200).json({
      success: true,
      data: {
        totalInputTokens: totalInput,
        totalOutputTokens: totalOutput,
        totalTokens: totalInput + totalOutput,
        byModel,
        messageCount: conversation.messages.length,
      },
    });
  } catch (error) {
    logger.error('Usage stats error:', error);
    res.status(500).json({ success: false, error: 'Error fetching usage stats' });
  }
});

/**
 * @route   GET /api/conversations/:id
 * @desc    Get a specific conversation with all messages
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const idError = validateObjectId(req.params.id);
    if (idError) {
      return res.status(400).json({ success: false, error: idError });
    }

    const conversation = await Conversation.getConversationById(req.params.id, req.user._id);

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({ success: false, error: 'Error fetching conversation' });
  }
});

/**
 * @route   POST /api/conversations/:id/messages
 * @desc    Add a message to a conversation
 * @access  Private
 */
router.post('/:id/messages', async (req, res) => {
  try {
    const idError = validateObjectId(req.params.id);
    if (idError) {
      return res.status(400).json({ success: false, error: idError });
    }

    const { role, content, agentId, metadata } = req.body;

    const messageError = validateAddMessage({ role, content, agentId });
    if (messageError) {
      return res.status(400).json({ success: false, error: messageError });
    }

    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.user._id });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    await conversation.addMessage(role, content, agentId, metadata);

    // Background summarization — fires after the response is sent so the
    // client is not blocked. Triggered once the conversation crosses the threshold
    // and only when no summary exists yet (avoids re-summarising on every message).
    const msgCount = conversation.messages?.length ?? 0;
    if (msgCount > SUMMARIZE_THRESHOLD && !conversation.summary) {
      setImmediate(async () => {
        try {
          const summary = await summarizeConversation(conversation.messages);
          await Conversation.findByIdAndUpdate(conversation._id, { summary });
          logger.info(`Background summary saved for conversation ${conversation._id}`);
        } catch (err) {
          logger.warn(`Background summarization failed: ${err.message}`);
        }
      });
    }

    res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    logger.error('Add message error:', error);
    res.status(500).json({ success: false, error: 'Error adding message' });
  }
});

/**
 * @route   PUT /api/conversations/:id
 * @desc    Update conversation (title, status, tags, etc.)
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const idError = validateObjectId(req.params.id);
    if (idError) {
      return res.status(400).json({ success: false, error: idError });
    }

    const { title, status, tags, summary } = req.body;

    const updateError = validateUpdateConversation({ title, status, tags, summary });
    if (updateError) {
      return res.status(400).json({ success: false, error: updateError });
    }

    // Use !== undefined so callers can explicitly clear fields (e.g. summary: "")
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (status !== undefined) updateData.status = status;
    if (tags !== undefined) updateData.tags = tags;
    if (summary !== undefined) updateData.summary = summary;

    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    logger.error('Update conversation error:', error);
    res.status(500).json({ success: false, error: 'Error updating conversation' });
  }
});

/**
 * @route   POST /api/conversations/:id/end
 * @desc    End a conversation, archive it, and generate PDF
 * @access  Private
 */
router.post('/:id/end', async (req, res) => {
  try {
    const idError = validateObjectId(req.params.id);
    if (idError) {
      return res.status(400).json({ success: false, error: idError });
    }

    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.user._id });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // Generate PDF first — only archive on success to allow retries on failure
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    let pdfBuffer;
    try {
      pdfBuffer = await new Promise((resolve, reject) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // ── Header ──────────────────────────────────────────────────────────
        doc.fontSize(20).font('Helvetica-Bold')
          .text('Multi-Agent Chat Conversation', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica')
          .text(`Title: ${conversation.title}`, { align: 'center' })
          .text(`Created: ${new Date(conversation.createdAt).toLocaleString()}`, { align: 'center' })
          .text(`Ended: ${new Date().toLocaleString()}`, { align: 'center' })
          .text(`Total Messages: ${conversation.messages.length}`, { align: 'center' });
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown();
        doc.fontSize(13).font('Helvetica-Bold').text('Conversation History');
        doc.moveDown(0.5);

        // ── Messages ────────────────────────────────────────────────────────
        conversation.messages.forEach((message, idx) => {
          if (idx > 0 && doc.y > 680) doc.addPage();

          const role = String(message.role || 'unknown');
          const content = String(message.content || '');
          const agentLabel = message.agentId ? ` (${message.agentId})` : '';
          const timestamp = message.timestamp ? new Date(message.timestamp).toLocaleString() : '';

          doc.fontSize(10).font('Helvetica-Bold')
            .text(`${role.charAt(0).toUpperCase() + role.slice(1)}${agentLabel}`, { continued: true })
            .font('Helvetica').fillColor('#666666')
            .text(`  ${timestamp}`)
            .fillColor('#000000');

          doc.fontSize(10).font('Helvetica').text(content, { width: 495 });
          doc.moveDown(0.5);

          if (idx < conversation.messages.length - 1) {
            doc.moveTo(50, doc.y).lineTo(545, doc.y).dash(3, { space: 3 }).stroke().undash();
            doc.moveDown(0.5);
          }
        });

        // ── Footer ──────────────────────────────────────────────────────────
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.fontSize(9).fillColor('#666666')
          .text('Generated by Multi-Agent Chatbot System', { align: 'center' })
          .text(`Conversation ID: ${conversation._id}`, { align: 'center' });

        doc.end();
      });
    } catch (pdfError) {
      // Destroy the stream to release internal resources
      doc.destroy?.();
      throw pdfError;
    }

    // PDF succeeded — now archive and persist
    conversation.status = 'archived';
    const fileName = `${conversation.title.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.pdf`;
    conversation.pdfExports.push({
      fileName,
      fileSize: pdfBuffer.length,
      data: pdfBuffer,
      mimeType: 'application/pdf',
      createdAt: new Date(),
    });
    await conversation.save();

    logger.info(`Conversation ended and PDF generated: ${req.params.id}`);

    // Use RFC 5987 encoding to avoid header-injection via special characters in title
    const encodedName = encodeURIComponent(fileName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('End conversation error:', error);
    res.status(500).json({ success: false, error: 'Error ending conversation' });
  }
});

/**
 * @route   POST /api/conversations/:id/tags
 * @desc    Add tags to a conversation
 * @access  Private
 */
router.post('/:id/tags', async (req, res) => {
  try {
    const idError = validateObjectId(req.params.id);
    if (idError) {
      return res.status(400).json({ success: false, error: idError });
    }

    const tagsError = validateTags(req.body);
    if (tagsError) {
      return res.status(400).json({ success: false, error: tagsError });
    }

    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.user._id });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    await conversation.addTags(req.body.tags);
    logger.info(`Tags added to conversation ${req.params.id}`);

    res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    logger.error('Add tags error:', error);
    res.status(500).json({ success: false, error: 'Error adding tags' });
  }
});

/**
 * @route   DELETE /api/conversations/:id/tags
 * @desc    Remove tags from a conversation
 * @access  Private
 */
router.delete('/:id/tags', async (req, res) => {
  try {
    const idError = validateObjectId(req.params.id);
    if (idError) {
      return res.status(400).json({ success: false, error: idError });
    }

    const tagsError = validateTags(req.body);
    if (tagsError) {
      return res.status(400).json({ success: false, error: tagsError });
    }

    const conversation = await Conversation.findOne({ _id: req.params.id, userId: req.user._id });

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    await conversation.removeTags(req.body.tags);
    logger.info(`Tags removed from conversation ${req.params.id}`);

    res.status(200).json({ success: true, data: conversation });
  } catch (error) {
    logger.error('Remove tags error:', error);
    res.status(500).json({ success: false, error: 'Error removing tags' });
  }
});

/**
 * @route   DELETE /api/conversations/:id
 * @desc    Delete a conversation (soft delete - set status to 'deleted')
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const idError = validateObjectId(req.params.id);
    if (idError) {
      return res.status(400).json({ success: false, error: idError });
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: 'deleted' },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    logger.info(`Conversation soft-deleted: ${req.params.id}`);

    res.status(200).json({ success: true, message: 'Conversation deleted successfully' });
  } catch (error) {
    logger.error('Delete conversation error:', error);
    res.status(500).json({ success: false, error: 'Error deleting conversation' });
  }
});

module.exports = router;
