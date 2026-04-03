'use strict';

/**
 * Agent Configuration Routes
 *
 * Provides CRUD operations on per-agent system-prompt and model config.
 * All routes are protected by the `authenticate` middleware.
 *
 * Mounted at /api in manager/index.js:
 *   GET    /api/agent-configs
 *   GET    /api/agent-configs/:agentId
 *   PUT    /api/agent-configs/:agentId
 *   POST   /api/agent-configs/:agentId/reset
 *   GET    /api/agent-templates
 */

const express = require('express');
const {
  getAllAgentConfigs,
  getAgentConfig,
  updateAgentConfig,
  resetAgentConfig,
  validateAgentConfig,
} = require('../shared/agent-config');
const { logger } = require('../shared/logger');

const router = express.Router();

// ── GET /api/agent-configs ────────────────────────────────────────────────────
router.get('/agent-configs', (req, res) => {
  try {
    const configs = getAllAgentConfigs();
    res.json({ success: true, configs });
  } catch (error) {
    logger.error('Error getting agent configurations:', error.message);
    res.status(500).json({ error: 'Failed to get agent configurations' });
  }
});

// ── GET /api/agent-configs/:agentId ──────────────────────────────────────────
router.get('/agent-configs/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;

    if (!/^agent-[1-4]$/.test(agentId)) {
      return res.status(400).json({ error: 'Invalid agent ID format' });
    }

    const config = getAgentConfig(agentId);
    res.json({ success: true, config });
  } catch (error) {
    logger.error('Error getting agent configuration:', error.message);
    res.status(500).json({ error: 'Failed to get agent configuration' });
  }
});

// ── PUT /api/agent-configs/:agentId ──────────────────────────────────────────
router.put('/agent-configs/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;
    const newConfig = req.body;

    if (!/^agent-[1-4]$/.test(agentId)) {
      return res.status(400).json({ error: 'Invalid agent ID format' });
    }

    const validationErrors = validateAgentConfig(newConfig);
    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Invalid configuration', details: validationErrors });
    }

    const success = updateAgentConfig(agentId, newConfig);
    if (success) {
      res.json({
        success:  true,
        message:  'Agent configuration updated successfully',
        config:   getAgentConfig(agentId),
      });
    } else {
      res.status(500).json({ error: 'Failed to update agent configuration' });
    }
  } catch (error) {
    logger.error('Error updating agent configuration:', error.message);
    res.status(500).json({ error: 'Failed to update agent configuration' });
  }
});

// ── POST /api/agent-configs/:agentId/reset ────────────────────────────────────
router.post('/agent-configs/:agentId/reset', (req, res) => {
  try {
    const { agentId } = req.params;

    if (!/^agent-[1-4]$/.test(agentId)) {
      return res.status(400).json({ error: 'Invalid agent ID format' });
    }

    const success = resetAgentConfig(agentId);
    if (success) {
      res.json({
        success:  true,
        message:  'Agent configuration reset to default',
        config:   getAgentConfig(agentId),
      });
    } else {
      res.status(500).json({ error: 'Failed to reset agent configuration' });
    }
  } catch (error) {
    logger.error('Error resetting agent configuration:', error.message);
    res.status(500).json({ error: 'Failed to reset agent configuration' });
  }
});

// ── GET /api/agent-templates ──────────────────────────────────────────────────
router.get('/agent-templates', (req, res) => {
  const templates = {
    coding: {
      name: 'Software Development Team',
      description: 'Perfect for coding projects, web apps, and software development tasks',
      agents: [
        {
          name:   'Frontend Developer',
          prompt: 'You are a senior frontend developer specializing in React, JavaScript, and modern web technologies. Focus on creating user-friendly interfaces, responsive designs, and efficient frontend code. Provide detailed code examples and explain your architectural decisions.',
        },
        {
          name:   'Backend Developer',
          prompt: 'You are a senior backend developer specializing in API design, database architecture, and server-side logic. Focus on creating scalable, secure backend systems with proper authentication and data handling. Provide API specifications and database schema suggestions.',
        },
        {
          name:   'DevOps Engineer',
          prompt: 'You are a DevOps engineer focused on deployment, CI/CD, and infrastructure. Provide recommendations for hosting, containerization, automated testing, and deployment strategies. Focus on scalability and reliability.',
        },
        {
          name:   'QA Engineer',
          prompt: 'You are a quality assurance engineer focused on testing strategies, identifying potential bugs, and ensuring code quality. Suggest testing approaches, identify edge cases, and recommend validation methods.',
        },
      ],
    },
    research: {
      name: 'Research Team',
      description: 'Ideal for research projects, data analysis, and academic investigations',
      agents: [
        {
          name:   'Primary Researcher',
          prompt: 'You are a primary researcher with expertise in academic methodology and data collection. Focus on research design, methodology, and comprehensive analysis. Provide structured findings with proper citations and evidence-based conclusions.',
        },
        {
          name:   'Data Analyst',
          prompt: 'You are a data analyst specializing in statistical analysis and data interpretation. Focus on quantitative analysis, trend identification, and data visualization recommendations. Provide insights based on data patterns and statistical significance.',
        },
        {
          name:   'Subject Matter Expert',
          prompt: 'You are a subject matter expert with deep domain knowledge. Provide specialized insights, industry context, and expert opinions. Focus on practical applications and real-world implications of research findings.',
        },
        {
          name:   'Research Coordinator',
          prompt: 'You are a research coordinator focused on methodology validation and research integrity. Ensure research quality, identify potential biases, and suggest improvements to research approaches.',
        },
      ],
    },
    business: {
      name: 'Business Strategy Team',
      description: 'Great for business planning, market analysis, and strategic decisions',
      agents: [
        {
          name:   'Market Analyst',
          prompt: 'You are a market research analyst specializing in consumer behavior and market trends. Analyze target demographics, market size, competition, and provide data-driven insights and market positioning recommendations.',
        },
        {
          name:   'Financial Analyst',
          prompt: 'You are a financial analyst focused on business economics and profitability. Analyze pricing strategies, cost structures, profit margins, and financial projections. Provide recommendations on financial viability and ROI.',
        },
        {
          name:   'Marketing Strategist',
          prompt: 'You are a marketing strategist with expertise in brand positioning and campaign development. Create comprehensive marketing strategies, identify key messaging, and suggest promotional channels.',
        },
        {
          name:   'Operations Manager',
          prompt: 'You are an operations manager specializing in business processes and efficiency. Focus on operational scalability, process optimization, and resource management. Provide recommendations for operational excellence.',
        },
      ],
    },
    creative: {
      name: 'Creative Team',
      description: 'Perfect for creative projects, content creation, and design work',
      agents: [
        {
          name:   'Creative Director',
          prompt: 'You are a creative director with expertise in brand storytelling and creative strategy. Develop compelling narratives, brand concepts, and creative direction. Focus on innovative and engaging creative solutions.',
        },
        {
          name:   'Visual Designer',
          prompt: 'You are a visual designer with expertise in graphic design and visual identity. Create visual concepts, design recommendations, and aesthetic direction. Focus on modern, appealing design principles.',
        },
        {
          name:   'Content Creator',
          prompt: 'You are a content creator specializing in engaging copy and content strategy. Develop compelling content, messaging, and communication strategies. Focus on audience engagement and brand voice.',
        },
        {
          name:   'UX Designer',
          prompt: 'You are a UX designer focused on user experience and customer journey. Design user-centered experiences, identify pain points, and recommend improvements. Focus on usability and accessibility.',
        },
      ],
    },
    technical: {
      name: 'Technical Analysis Team',
      description: 'Ideal for technical problem-solving, system design, and engineering tasks',
      agents: [
        {
          name:   'System Architect',
          prompt: 'You are a system architect with expertise in large-scale system design. Focus on scalability, reliability, and performance. Provide architectural recommendations and design patterns.',
        },
        {
          name:   'Security Engineer',
          prompt: 'You are a security engineer focused on cybersecurity and system protection. Identify security vulnerabilities, recommend security measures, and ensure compliance with security standards.',
        },
        {
          name:   'Performance Engineer',
          prompt: 'You are a performance engineer specializing in optimization and efficiency. Analyze performance bottlenecks, recommend optimizations, and ensure system scalability.',
        },
        {
          name:   'Technical Writer',
          prompt: 'You are a technical writer focused on documentation and knowledge transfer. Create clear technical documentation, user guides, and ensure technical concepts are well-explained.',
        },
      ],
    },
  };

  res.json({ success: true, templates });
});

module.exports = router;
