/**
 * Voting Session Integration Test
 *
 * Tests the voting session functionality with the bug fix
 */

const axios = require('axios');

const MANAGER_URL = 'http://localhost:3000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testVotingSession() {
  log('\n🗳️  Testing Voting Session...', 'blue');

  try {
    // Test data
    const votingRequest = {
      problem: "What is the best programming language for web development?",
      participants: [
        { agentId: 'agent-1', agentName: 'Alice', weight: 1.0 },
        { agentId: 'agent-2', agentName: 'Bob', weight: 1.0 },
        { agentId: 'agent-3', agentName: 'Charlie', weight: 1.0 }
      ],
      votingStrategy: 'weighted',
      userId: 'test-user-123'
    };

    log('📤 Sending voting session request...', 'yellow');
    log(`Problem: ${votingRequest.problem}`, 'yellow');
    log(`Participants: ${votingRequest.participants.map(p => p.agentName).join(', ')}`, 'yellow');

    const startTime = Date.now();
    const response = await axios.post(
      `${MANAGER_URL}/voting-session`,
      votingRequest,
      { timeout: 120000 } // 2 minute timeout
    );
    const duration = Date.now() - startTime;

    if (response.status === 200 && response.data.success) {
      log('\n✅ Voting session completed successfully!', 'green');
      log(`Duration: ${(duration / 1000).toFixed(2)}s`, 'green');

      const { proposals, votes, results, winner } = response.data;

      // Display proposals
      log('\n📋 Proposals:', 'blue');
      proposals.forEach((proposal, index) => {
        log(`\nProposal ${index + 1} by ${proposal.agentName}:`, 'magenta');
        log(proposal.content.substring(0, 150) + '...', 'reset');
      });

      // Display votes
      log('\n🗳️  Votes:', 'blue');
      log(`Total votes: ${votes.length}`, 'yellow');

      // Display results
      log('\n🏆 Results:', 'blue');
      log(`Strategy: ${results.strategy}`, 'yellow');
      log(`Confidence: ${(results.confidence * 100).toFixed(1)}%`, 'yellow');

      if (winner) {
        log(`\n🥇 Winner: ${winner.agentName}`, 'green');
        log(`Content: ${winner.content.substring(0, 200)}...`, 'reset');
      }

      return { success: true, duration, proposals, votes, results };
    } else {
      log('❌ Voting session failed', 'red');
      log(`Response: ${JSON.stringify(response.data)}`, 'red');
      return { success: false };
    }

  } catch (error) {
    log('❌ Voting session error:', 'red');
    log(error.message, 'red');
    if (error.response) {
      log(`Status: ${error.response.status}`, 'red');
      log(`Data: ${JSON.stringify(error.response.data)}`, 'red');
    }
    return { success: false, error: error.message };
  }
}

async function testRankedChoiceVoting() {
  log('\n🗳️  Testing Ranked Choice Voting...', 'blue');

  try {
    const votingRequest = {
      problem: "Design a solution for reducing carbon emissions in urban areas.",
      participants: [
        { agentId: 'agent-1', agentName: 'Alice' },
        { agentId: 'agent-2', agentName: 'Bob' },
        { agentId: 'agent-3', agentName: 'Charlie' },
        { agentId: 'agent-4', agentName: 'Diana' }
      ],
      votingStrategy: 'ranked_choice',
      userId: 'test-user-456'
    };

    log('📤 Sending ranked choice voting request...', 'yellow');
    log(`Problem: ${votingRequest.problem}`, 'yellow');

    const startTime = Date.now();
    const response = await axios.post(
      `${MANAGER_URL}/voting-session`,
      votingRequest,
      { timeout: 180000 } // 3 minute timeout for 4 agents
    );
    const duration = Date.now() - startTime;

    if (response.status === 200 && response.data.success) {
      log('\n✅ Ranked choice voting completed!', 'green');
      log(`Duration: ${(duration / 1000).toFixed(2)}s`, 'green');

      const { proposals, votes, results, winner } = response.data;

      log(`\n📊 Statistics:`, 'blue');
      log(`Proposals received: ${proposals.length}`, 'yellow');
      log(`Votes cast: ${votes.length}`, 'yellow');
      log(`Confidence: ${(results.confidence * 100).toFixed(1)}%`, 'yellow');

      if (winner) {
        log(`\n🥇 Winner: ${winner.agentName}`, 'green');
      }

      return { success: true, duration, proposals: proposals.length, votes: votes.length };
    } else {
      log('❌ Ranked choice voting failed', 'red');
      return { success: false };
    }

  } catch (error) {
    log('❌ Ranked choice voting error:', 'red');
    log(error.message, 'red');
    return { success: false, error: error.message };
  }
}

async function testMinimumParticipants() {
  log('\n🗳️  Testing Minimum Participants Validation...', 'blue');

  try {
    const votingRequest = {
      problem: "Test problem",
      participants: [
        { agentId: 'agent-1', agentName: 'Alice' }
      ],
      votingStrategy: 'weighted'
    };

    const response = await axios.post(
      `${MANAGER_URL}/voting-session`,
      votingRequest,
      { timeout: 60000 }
    );

    log('❌ Should have rejected with 1 participant', 'red');
    return { success: false };

  } catch (error) {
    if (error.response && error.response.status === 400) {
      log('✅ Correctly rejected with 1 participant', 'green');
      log(`Error message: ${error.response.data.error}`, 'yellow');
      return { success: true };
    } else {
      log('❌ Unexpected error', 'red');
      return { success: false };
    }
  }
}

async function runAllTests() {
  log('═══════════════════════════════════════════', 'blue');
  log('  VOTING SESSION INTEGRATION TESTS', 'blue');
  log('═══════════════════════════════════════════', 'blue');

  // Check if manager is running
  try {
    await axios.get(`${MANAGER_URL}/api/health`, { timeout: 5000 });
    log('✅ Manager service is running\n', 'green');
  } catch (error) {
    log('❌ Manager service is not running!', 'red');
    log('Please start the services first: npm start\n', 'red');
    process.exit(1);
  }

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // Test 1: Basic weighted voting
  const test1 = await testVotingSession();
  results.tests.push({ name: 'Weighted Voting', ...test1 });
  if (test1.success) results.passed++; else results.failed++;

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 2: Ranked choice voting
  const test2 = await testRankedChoiceVoting();
  results.tests.push({ name: 'Ranked Choice Voting', ...test2 });
  if (test2.success) results.passed++; else results.failed++;

  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Validation
  const test3 = await testMinimumParticipants();
  results.tests.push({ name: 'Minimum Participants Validation', ...test3 });
  if (test3.success) results.passed++; else results.failed++;

  // Summary
  log('\n═══════════════════════════════════════════', 'blue');
  log('  TEST SUMMARY', 'blue');
  log('═══════════════════════════════════════════', 'blue');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`❌ Failed: ${results.failed}`, 'red');
  log(`📊 Total: ${results.tests.length}`, 'blue');

  if (results.failed === 0) {
    log('\n🎉 All tests passed!', 'green');
  } else {
    log('\n⚠️  Some tests failed', 'yellow');
  }

  return results;
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  }).catch(error => {
    log(`\n❌ Test suite error: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { testVotingSession, testRankedChoiceVoting, runAllTests };
