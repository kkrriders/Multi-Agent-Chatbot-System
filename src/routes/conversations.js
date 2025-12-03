const express = require('express');
const Conversation = require('../models/Conversation');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../shared/logger');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/conversations
 * @desc    Get all conversations for the logged-in user
 * @access  Private
 */
router.get('/', async (req, res) => {
  try {
    const { status = 'active', limit = 50 } = req.query;

    const conversations = await Conversation.getUserConversations(
      req.user._id,
      status,
      parseInt(limit)
    );

    res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations,
    });
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching conversations',
    });
  }
});

/**
 * @route   GET /api/conversations/:id
 * @desc    Get a specific conversation with all messages
 * @access  Private
 */
router.get('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.getConversationById(
      req.params.id,
      req.user._id
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching conversation',
    });
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

    const conversation = await Conversation.create({
      userId: req.user._id,
      title: title || 'New Conversation',
      agentType: agentType || 'manager',
      messages: [],
    });

    logger.info(`New conversation created for user: ${req.user.email}`);

    res.status(201).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating conversation',
    });
  }
});

/**
 * @route   POST /api/conversations/:id/messages
 * @desc    Add a message to a conversation
 * @access  Private
 */
router.post('/:id/messages', async (req, res) => {
  try {
    const { role, content, agentId, metadata } = req.body;

    if (!role || !content) {
      return res.status(400).json({
        success: false,
        error: 'Role and content are required',
      });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    await conversation.addMessage(role, content, agentId, metadata);

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Add message error:', error);
    res.status(500).json({
      success: false,
      error: 'Error adding message',
    });
  }
});

/**
 * @route   PUT /api/conversations/:id
 * @desc    Update conversation (title, status, tags, etc.)
 * @access  Private
 */
router.put('/:id', async (req, res) => {
  try {
    const { title, status, tags, summary } = req.body;

    const updateData = {};
    if (title) updateData.title = title;
    if (status) updateData.status = status;
    if (tags) updateData.tags = tags;
    if (summary) updateData.summary = summary;

    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Update conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating conversation',
    });
  }
});

/**
 * @route   POST /api/conversations/:id/end
 * @desc    End a conversation, archive it, and generate PDF
 * @access  Private
 */
router.post('/:id/end', async (req, res) => {
  try {
    const puppeteer = require('puppeteer');

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    // Archive the conversation
    conversation.status = 'archived';
    await conversation.save();

    logger.info(`Conversation ended: ${req.params.id}`);

    // Generate PDF
    const escapeHtml = (text) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(conversation.title)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .message { margin: 15px 0; padding: 10px; border-radius: 5px; }
          .user-message { background-color: #e7f5fe; border-left: 4px solid #2196F3; }
          .assistant-message { background-color: #f0f8ea; border-left: 4px solid #4CAF50; }
          .system-message { background-color: #fff3cd; border-left: 4px solid #ffc107; }
          .message-header { font-weight: bold; margin-bottom: 5px; }
          .timestamp { font-size: 0.8em; color: #666; margin-left: 10px; }
          .footer { margin-top: 30px; text-align: center; font-size: 0.8em; color: #666; border-top: 1px solid #ccc; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Multi-Agent Chat Conversation</h1>
          <p><strong>Title:</strong> ${escapeHtml(conversation.title)}</p>
          <p><strong>Created:</strong> ${new Date(conversation.createdAt).toLocaleString()}</p>
          <p><strong>Ended:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>Total Messages:</strong> ${conversation.messages.length}</p>
        </div>

        <div class="conversation">
          <h3>Conversation History:</h3>
    `;

    conversation.messages.forEach(message => {
      const messageClass = `${message.role}-message`;
      const timestamp = new Date(message.timestamp).toLocaleString();
      const escapedRole = escapeHtml(message.role);
      const escapedContent = escapeHtml(message.content).replace(/\n/g, '<br>');

      htmlContent += `
        <div class="message ${messageClass}">
          <div class="message-header">
            ${escapedRole.charAt(0).toUpperCase() + escapedRole.slice(1)}
            ${message.agentId ? `(${escapeHtml(message.agentId)})` : ''}
            <span class="timestamp">${timestamp}</span>
          </div>
          <div class="content">${escapedContent}</div>
        </div>
      `;
    });

    htmlContent += `
        </div>
        <div class="footer">
          <p>Generated by Multi-Agent Chatbot System</p>
          <p>Conversation ID: ${conversation._id}</p>
        </div>
      </body>
      </html>
    `;

    // Generate PDF using Puppeteer (in memory)
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let pdfBuffer;
    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in'
        },
        printBackground: true
      });
    } finally {
      await browser.close();
    }

    // Save PDF to MongoDB
    const fileName = `${conversation.title.replace(/[^a-z0-9]/gi, '_')}-${Date.now()}.pdf`;

    conversation.pdfExports.push({
      fileName,
      fileSize: pdfBuffer.length,
      data: pdfBuffer,
      mimeType: 'application/pdf',
      createdAt: new Date()
    });

    await conversation.save();

    logger.info(`PDF generated and saved for conversation ${req.params.id}`);

    // Send PDF to user
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);

  } catch (error) {
    logger.error('End conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Error ending conversation',
    });
  }
});

/**
 * @route   POST /api/conversations/:id/tags
 * @desc    Add tags to a conversation
 * @access  Private
 */
router.post('/:id/tags', async (req, res) => {
  try {
    const { tags } = req.body;

    if (!tags || (Array.isArray(tags) && tags.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'At least one tag is required',
      });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    await conversation.addTags(tags);

    logger.info(`Tags added to conversation ${req.params.id}: ${JSON.stringify(tags)}`);

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Add tags error:', error);
    res.status(500).json({
      success: false,
      error: 'Error adding tags',
    });
  }
});

/**
 * @route   DELETE /api/conversations/:id/tags
 * @desc    Remove tags from a conversation
 * @access  Private
 */
router.delete('/:id/tags', async (req, res) => {
  try {
    const { tags } = req.body;

    if (!tags || (Array.isArray(tags) && tags.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'At least one tag is required',
      });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    await conversation.removeTags(tags);

    logger.info(`Tags removed from conversation ${req.params.id}: ${JSON.stringify(tags)}`);

    res.status(200).json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    logger.error('Remove tags error:', error);
    res.status(500).json({
      success: false,
      error: 'Error removing tags',
    });
  }
});

/**
 * @route   GET /api/conversations/tags/all
 * @desc    Get all unique tags for the user with counts
 * @access  Private
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
    res.status(500).json({
      success: false,
      error: 'Error fetching tags',
    });
  }
});

/**
 * @route   GET /api/conversations/search/by-tags
 * @desc    Search conversations by tags
 * @access  Private
 */
router.get('/search/by-tags', async (req, res) => {
  try {
    const { tags, status = 'active' } = req.query;

    if (!tags) {
      return res.status(400).json({
        success: false,
        error: 'Tags parameter is required',
      });
    }

    const searchTags = Array.isArray(tags) ? tags : tags.split(',');
    const conversations = await Conversation.findByTags(
      req.user._id,
      searchTags,
      status
    );

    res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations,
    });
  } catch (error) {
    logger.error('Search by tags error:', error);
    res.status(500).json({
      success: false,
      error: 'Error searching conversations',
    });
  }
});

/**
 * @route   DELETE /api/conversations/:id
 * @desc    Delete a conversation (soft delete - set status to 'deleted')
 * @access  Private
 */
router.delete('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { status: 'deleted' },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      });
    }

    logger.info(`Conversation deleted: ${req.params.id}`);

    res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (error) {
    logger.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Error deleting conversation',
    });
  }
});

module.exports = router;
