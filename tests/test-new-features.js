/**
 * Test script for new features implemented today
 * Tests: Rate Limiting, Tagging, and Voting System
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(60), 'cyan');
  log(`  ${title}`, 'cyan');
  log('='.repeat(60), 'cyan');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Test 1: Rate Limiting
async function testRateLimiting() {
  logSection('TEST 1: Rate Limiting');

  try {
    logInfo('Making rapid requests to test rate limiter...');

    const requests = [];
    for (let i = 0; i < 35; i++) {
      requests.push(
        axios.post(`${BASE_URL}/message`, {
          content: `Test message ${i}`,
          agentId: 'agent-1',
          agentName: 'Test Agent'
        }).catch((err) => err.response)
      );
    }

    const responses = await Promise.all(requests);

    const successCount = responses.filter((r) => r && r.status === 200).length;
    const rateLimitedCount = responses.filter((r) => r && r.status === 429).length;

    logInfo(`Sent 35 requests`);
    logInfo(`Successful: ${successCount}`);
    logInfo(`Rate limited: ${rateLimitedCount}`);

    if (rateLimitedCount > 0) {
      logSuccess('Rate limiting is working! Got 429 responses.');

      const rateLimitResponse = responses.find((r) => r && r.status === 429);
      if (rateLimitResponse) {
        logInfo('Rate limit response:');
        console.log(JSON.stringify(rateLimitResponse.data, null, 2));
      }
    } else {
      logError('Rate limiting may not be working - no 429 responses');
    }
  } catch (error) {
    logError(`Rate limiting test failed: ${error.message}`);
  }
}

// Test 2: Conversation Tagging (requires auth)
async function testTagging(token) {
  logSection('TEST 2: Conversation Tagging');

  if (!token) {
    logError('Skipping tagging test - no authentication token provided');
    logInfo('To test tagging, pass a valid JWT token as argument');
    return;
  }

  try {
    // Create a test conversation
    logInfo('Creating test conversation...');
    const createRes = await axios.post(
      `${BASE_URL}/api/conversations`,
      {
        title: 'Test Conversation for Tagging',
        agentType: 'manager'
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    const conversationId = createRes.data.data._id;
    logSuccess(`Created conversation: ${conversationId}`);

    // Add tags
    logInfo('Adding tags...');
    const addTagsRes = await axios.post(
      `${BASE_URL}/api/conversations/${conversationId}/tags`,
      {
        tags: ['test', 'important', 'feature-demo']
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    logSuccess('Tags added successfully');
    logInfo(`Tags: ${addTagsRes.data.data.tags.join(', ')}`);

    // Get all tags
    logInfo('Fetching all user tags...');
    const allTagsRes = await axios.get(`${BASE_URL}/api/conversations/tags/all`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    logSuccess(`Found ${allTagsRes.data.count} unique tags`);
    allTagsRes.data.data.slice(0, 5).forEach((tagData) => {
      logInfo(`  - ${tagData.tag} (${tagData.count} uses)`);
    });

    // Search by tags
    logInfo('Searching conversations by tags...');
    const searchRes = await axios.get(
      `${BASE_URL}/api/conversations/search/by-tags?tags=test,important`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    logSuccess(`Found ${searchRes.data.count} conversations with those tags`);

    // Remove a tag
    logInfo('Removing a tag...');
    await axios.delete(
      `${BASE_URL}/api/conversations/${conversationId}/tags`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { tags: ['test'] }
      }
    );

    logSuccess('Tag removed successfully');
  } catch (error) {
    logError(`Tagging test failed: ${error.message}`);
    if (error.response) {
      console.log('Response:', error.response.data);
    }
  }
}

// Test 3: Agent Voting System
async function testVoting() {
  logSection('TEST 3: Agent Voting System');

  try {
    logInfo('Starting voting session...');
    logInfo('Problem: "What is the best way to optimize database queries?"');

    const votingRes = await axios.post(`${BASE_URL}/voting-session`, {
      problem: 'What is the best way to optimize database queries?',
      participants: [
        { agentId: 'agent-1', agentName: 'Database Expert', weight: 2.0 },
        { agentId: 'agent-2', agentName: 'Performance Specialist', weight: 1.5 },
        { agentId: 'agent-3', agentName: 'Developer', weight: 1.0 }
      ],
      votingStrategy: 'weighted'
    });

    logSuccess('Voting session completed!');

    logInfo('\n--- Proposals ---');
    votingRes.data.proposals.forEach((proposal, index) => {
      log(`\nProposal ${index + 1} by ${proposal.agentName}:`, 'yellow');
      console.log(proposal.content.substring(0, 200) + '...\n');
    });

    logInfo('--- Voting Results ---');
    log(`Winner: ${votingRes.data.winner.agentName}`, 'green');
    log(`Confidence: ${(votingRes.data.results.confidence * 100).toFixed(1)}%`, 'green');
    log(`Total Votes: ${votingRes.data.results.totalVotes}`, 'blue');

    logInfo('\n--- Detailed Results ---');
    console.log(votingRes.data.summary);
  } catch (error) {
    logError(`Voting test failed: ${error.message}`);
    if (error.response) {
      console.log('Response:', error.response.data);
    }
  }
}

// Test 4: ESLint (check if configured)
async function testESLint() {
  logSection('TEST 4: ESLint Configuration');

  try {
    const fs = require('fs');
    const path = require('path');

    const eslintConfigPath = path.join(__dirname, '.eslintrc.json');
    const prettierConfigPath = path.join(__dirname, '.prettierrc.json');

    if (fs.existsSync(eslintConfigPath)) {
      logSuccess('ESLint configuration file exists');
      const config = JSON.parse(fs.readFileSync(eslintConfigPath, 'utf8'));
      logInfo(`Rules configured: ${Object.keys(config.rules || {}).length}`);
    } else {
      logError('ESLint configuration file not found');
    }

    if (fs.existsSync(prettierConfigPath)) {
      logSuccess('Prettier configuration file exists');
      const config = JSON.parse(fs.readFileSync(prettierConfigPath, 'utf8'));
      logInfo('Prettier settings:');
      Object.entries(config).forEach(([key, value]) => {
        logInfo(`  - ${key}: ${value}`);
      });
    } else {
      logError('Prettier configuration file not found');
    }

    logInfo('\nRun "npm run lint" to check code quality');
    logInfo('Run "npm run format" to format code');
  } catch (error) {
    logError(`ESLint test failed: ${error.message}`);
  }
}

// Main test runner
async function runTests() {
  log('\n🧪 NEW FEATURES TEST SUITE 🧪\n', 'cyan');

  const token = process.argv[2]; // Optional JWT token for auth tests

  if (!token) {
    logInfo('Note: Some tests require authentication.');
    logInfo('Usage: node test-new-features.js <YOUR_JWT_TOKEN>\n');
  }

  // Check if server is running
  try {
    await axios.get(`${BASE_URL}/status`);
    logSuccess('Server is running');
  } catch (error) {
    logError('Server is not running! Please start it first.');
    logInfo('Run: npm start');
    process.exit(1);
  }

  // Run tests
  await testESLint();
  await sleep(1000);

  await testRateLimiting();
  await sleep(2000);

  if (token) {
    await testTagging(token);
    await sleep(2000);
  }

  await testVoting();

  logSection('TEST SUITE COMPLETE');
  log('✓ All tests finished!\n', 'green');
  logInfo('Check the output above for results.');
}

// Run tests
runTests().catch((error) => {
  logError(`Test suite failed: ${error.message}`);
  console.error(error);
  process.exit(1);
});
