/**
 * PromptVersion — versioned system prompt registry
 *
 * Stores named, versioned system prompts per agent in MongoDB.
 * Only one version can be "active" per agent at a time.
 * agent-config.js queries the active version (cached 60 s) before
 * falling back to the JSON file on disk.
 *
 * Why MongoDB and not a JSON file?
 *   Version history, activation history, and per-user A/B testing
 *   all become straightforward with a database-backed registry.
 */

const mongoose = require('mongoose');

const promptVersionSchema = new mongoose.Schema({
  agentId: {
    type: String,
    required: true,
    index: true,
  },
  version: {
    type: Number,
    required: true,
  },
  systemPrompt: {
    type: String,
    required: true,
    maxlength: 10_000,
  },
  description: {
    type: String,
    maxlength: 500,
  },
  active: {
    type: Boolean,
    default: false,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Compound index: fast lookup of the active version for an agent
promptVersionSchema.index({ agentId: 1, active: 1 });
// Enforce unique version numbers per agent
promptVersionSchema.index({ agentId: 1, version: 1 }, { unique: true });

/**
 * Return the active prompt version document for an agent (lean).
 */
promptVersionSchema.statics.getActive = function(agentId) {
  return this.findOne({ agentId, active: true }).lean();
};

/**
 * Atomically activate one version and deactivate all others for the agent.
 */
promptVersionSchema.statics.activate = async function(agentId, versionId) {
  await this.updateMany({ agentId }, { $set: { active: false } });
  return this.findByIdAndUpdate(
    versionId,
    { $set: { active: true } },
    { new: true }
  );
};

/**
 * Return the next sequential version number for an agent.
 */
promptVersionSchema.statics.nextVersionNumber = async function(agentId) {
  const latest = await this.findOne({ agentId }).sort({ version: -1 }).select('version').lean();
  return (latest?.version ?? 0) + 1;
};

const PromptVersion = mongoose.model('PromptVersion', promptVersionSchema);

module.exports = PromptVersion;
