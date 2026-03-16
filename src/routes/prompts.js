'use strict';

/**
 * Prompt Versioning API
 *
 * CRUD routes for the per-agent prompt version registry.
 * All routes require authentication; only the conversation owner
 * (any authenticated user) may create/activate prompts for now —
 * tighten to admin-only when roles are added.
 *
 * Mounted at: /api/prompts
 */

const express = require('express');
const mongoose = require('mongoose');
const PromptVersion = require('../models/PromptVersion');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../shared/logger');
const { invalidatePromptCache } = require('../shared/agent-config');

const router = express.Router();
router.use(authenticate);

// ─── Validators ───────────────────────────────────────────────────────────────

const VALID_AGENT_IDS = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'manager'];

function validateAgentId(agentId) {
  if (!VALID_AGENT_IDS.includes(agentId)) {
    return `agentId must be one of: ${VALID_AGENT_IDS.join(', ')}`;
  }
  return null;
}

function validateVersionId(id) {
  if (!mongoose.Types.ObjectId.isValid(id) || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return 'Invalid version ID format';
  }
  return null;
}

function validateCreateBody({ systemPrompt, description }) {
  if (!systemPrompt || typeof systemPrompt !== 'string' || systemPrompt.trim().length === 0) {
    return 'systemPrompt is required and must be a non-empty string';
  }
  if (systemPrompt.length > 10_000) {
    return 'systemPrompt must not exceed 10,000 characters';
  }
  if (description !== undefined && (typeof description !== 'string' || description.length > 500)) {
    return 'description must be a string with max 500 characters';
  }
  return null;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * @route  GET /api/prompts/:agentId
 * @desc   List all prompt versions for an agent (newest first)
 */
router.get('/:agentId', async (req, res) => {
  const agentError = validateAgentId(req.params.agentId);
  if (agentError) return res.status(400).json({ success: false, error: agentError });

  try {
    const versions = await PromptVersion.find({ agentId: req.params.agentId })
      .sort({ version: -1 })
      .select('-__v')
      .lean();

    res.status(200).json({ success: true, count: versions.length, data: versions });
  } catch (err) {
    logger.error('List prompt versions error:', err);
    res.status(500).json({ success: false, error: 'Error listing prompt versions' });
  }
});

/**
 * @route  POST /api/prompts/:agentId
 * @desc   Create a new prompt version (inactive by default)
 */
router.post('/:agentId', async (req, res) => {
  const agentError = validateAgentId(req.params.agentId);
  if (agentError) return res.status(400).json({ success: false, error: agentError });

  const bodyError = validateCreateBody(req.body);
  if (bodyError) return res.status(400).json({ success: false, error: bodyError });

  try {
    const version = await PromptVersion.nextVersionNumber(req.params.agentId);
    const doc = await PromptVersion.create({
      agentId:      req.params.agentId,
      version,
      systemPrompt: req.body.systemPrompt.trim(),
      description:  req.body.description?.trim(),
      active:       false,
      createdBy:    req.user._id,
    });

    logger.info(`Prompt version ${version} created for ${req.params.agentId} by ${req.user.email}`);
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    logger.error('Create prompt version error:', err);
    res.status(500).json({ success: false, error: 'Error creating prompt version' });
  }
});

/**
 * @route  PUT /api/prompts/:agentId/:versionId/activate
 * @desc   Activate a specific version (deactivates all others for this agent)
 */
router.put('/:agentId/:versionId/activate', async (req, res) => {
  const agentError = validateAgentId(req.params.agentId);
  if (agentError) return res.status(400).json({ success: false, error: agentError });

  const idError = validateVersionId(req.params.versionId);
  if (idError) return res.status(400).json({ success: false, error: idError });

  try {
    const doc = await PromptVersion.activate(req.params.agentId, req.params.versionId);
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Prompt version not found' });
    }

    // Bust the in-process cache so the next request picks up the new prompt
    invalidatePromptCache(req.params.agentId);

    logger.info(`Prompt v${doc.version} activated for ${req.params.agentId} by ${req.user.email}`);
    res.status(200).json({ success: true, data: doc });
  } catch (err) {
    logger.error('Activate prompt version error:', err);
    res.status(500).json({ success: false, error: 'Error activating prompt version' });
  }
});

/**
 * @route  DELETE /api/prompts/:agentId/:versionId
 * @desc   Delete a prompt version (cannot delete the active version)
 */
router.delete('/:agentId/:versionId', async (req, res) => {
  const agentError = validateAgentId(req.params.agentId);
  if (agentError) return res.status(400).json({ success: false, error: agentError });

  const idError = validateVersionId(req.params.versionId);
  if (idError) return res.status(400).json({ success: false, error: idError });

  try {
    const doc = await PromptVersion.findById(req.params.versionId);
    if (!doc || doc.agentId !== req.params.agentId) {
      return res.status(404).json({ success: false, error: 'Prompt version not found' });
    }
    if (doc.active) {
      return res.status(409).json({ success: false, error: 'Cannot delete the active prompt version — activate another version first' });
    }

    await doc.deleteOne();
    logger.info(`Prompt version ${doc.version} deleted for ${req.params.agentId}`);
    res.status(200).json({ success: true, message: 'Prompt version deleted' });
  } catch (err) {
    logger.error('Delete prompt version error:', err);
    res.status(500).json({ success: false, error: 'Error deleting prompt version' });
  }
});

module.exports = router;
