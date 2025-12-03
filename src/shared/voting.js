/**
 * Agent Voting System
 *
 * Enables agents to vote on proposed solutions and automatically
 * determine the best answer based on collective intelligence.
 */

const { logger } = require('./logger');

/**
 * Vote types
 */
const VOTE_TYPE = {
  UPVOTE: 'upvote',
  DOWNVOTE: 'downvote',
  ABSTAIN: 'abstain'
};

/**
 * Voting strategies
 */
const VOTING_STRATEGY = {
  MAJORITY: 'majority',           // Simple majority wins
  WEIGHTED: 'weighted',           // Weighted by agent expertise
  CONSENSUS: 'consensus',         // Requires high agreement (>75%)
  RANKED_CHOICE: 'ranked_choice'  // Agents rank all options
};

/**
 * Calculate voting results using different strategies
 */
class VotingSystem {
  /**
   * Process votes using simple majority
   * @param {Array} proposals - Array of proposal objects
   * @param {Array} votes - Array of vote objects
   * @returns {Object} Winner and voting statistics
   */
  static majority(proposals, votes) {
    const voteCounts = {};

    // Initialize counts
    proposals.forEach(proposal => {
      voteCounts[proposal.id] = {
        upvotes: 0,
        downvotes: 0,
        abstain: 0,
        voters: []
      };
    });

    // Count votes
    votes.forEach(vote => {
      if (voteCounts[vote.proposalId]) {
        voteCounts[vote.proposalId][`${vote.type}s`]++;
        voteCounts[vote.proposalId].voters.push(vote.agentId);
      }
    });

    // Find winner (highest upvotes)
    let winner = null;
    let maxUpvotes = -1;

    Object.entries(voteCounts).forEach(([proposalId, counts]) => {
      if (counts.upvotes > maxUpvotes) {
        maxUpvotes = counts.upvotes;
        winner = proposalId;
      }
    });

    const winnerProposal = proposals.find(p => p.id === winner);

    return {
      winner,
      winnerProposal,
      strategy: VOTING_STRATEGY.MAJORITY,
      voteCounts,
      totalVotes: votes.length,
      confidence: maxUpvotes / votes.length
    };
  }

  /**
   * Process votes with weighted scoring based on agent expertise
   * @param {Array} proposals - Array of proposal objects
   * @param {Array} votes - Array of vote objects with weights
   * @returns {Object} Winner and voting statistics
   */
  static weighted(proposals, votes) {
    const scores = {};

    // Initialize scores
    proposals.forEach(proposal => {
      scores[proposal.id] = {
        score: 0,
        upvotes: 0,
        downvotes: 0,
        abstain: 0,
        voters: []
      };
    });

    // Calculate weighted scores
    votes.forEach(vote => {
      if (scores[vote.proposalId]) {
        const weight = vote.weight || 1.0; // Default weight is 1.0

        if (vote.type === VOTE_TYPE.UPVOTE) {
          scores[vote.proposalId].score += weight;
          scores[vote.proposalId].upvotes++;
        } else if (vote.type === VOTE_TYPE.DOWNVOTE) {
          scores[vote.proposalId].score -= weight;
          scores[vote.proposalId].downvotes++;
        } else {
          scores[vote.proposalId].abstain++;
        }

        scores[vote.proposalId].voters.push({
          agentId: vote.agentId,
          weight
        });
      }
    });

    // Find winner (highest score)
    let winner = null;
    let maxScore = -Infinity;

    Object.entries(scores).forEach(([proposalId, data]) => {
      if (data.score > maxScore) {
        maxScore = data.score;
        winner = proposalId;
      }
    });

    const winnerProposal = proposals.find(p => p.id === winner);
    const totalWeight = votes.reduce((sum, v) => sum + (v.weight || 1.0), 0);

    return {
      winner,
      winnerProposal,
      strategy: VOTING_STRATEGY.WEIGHTED,
      scores,
      totalVotes: votes.length,
      confidence: maxScore / totalWeight
    };
  }

  /**
   * Require consensus (>75% agreement)
   * @param {Array} proposals - Array of proposal objects
   * @param {Array} votes - Array of vote objects
   * @returns {Object} Winner and voting statistics
   */
  static consensus(proposals, votes) {
    const result = this.majority(proposals, votes);
    const threshold = 0.75;

    // Check if winner meets consensus threshold
    const hasConsensus = result.confidence >= threshold;

    return {
      ...result,
      strategy: VOTING_STRATEGY.CONSENSUS,
      hasConsensus,
      threshold,
      message: hasConsensus
        ? 'Consensus reached'
        : `No consensus (${(result.confidence * 100).toFixed(1)}% < ${threshold * 100}%)`
    };
  }

  /**
   * Ranked choice voting - agents rank all proposals
   * @param {Array} proposals - Array of proposal objects
   * @param {Array} rankedVotes - Array of ranked vote objects
   * @returns {Object} Winner and voting statistics
   */
  static rankedChoice(proposals, rankedVotes) {
    // Points: 1st choice = n points, 2nd = n-1, etc.
    const numProposals = proposals.length;
    const scores = {};

    // Initialize
    proposals.forEach(proposal => {
      scores[proposal.id] = {
        totalPoints: 0,
        rankings: {},
        voters: []
      };

      for (let i = 1; i <= numProposals; i++) {
        scores[proposal.id].rankings[i] = 0;
      }
    });

    // Calculate points
    rankedVotes.forEach(vote => {
      vote.rankings.forEach((proposalId, index) => {
        const rank = index + 1;
        const points = numProposals - index;

        if (scores[proposalId]) {
          scores[proposalId].totalPoints += points;
          scores[proposalId].rankings[rank]++;
          scores[proposalId].voters.push(vote.agentId);
        }
      });
    });

    // Find winner
    let winner = null;
    let maxPoints = -1;

    Object.entries(scores).forEach(([proposalId, data]) => {
      if (data.totalPoints > maxPoints) {
        maxPoints = data.totalPoints;
        winner = proposalId;
      }
    });

    const winnerProposal = proposals.find(p => p.id === winner);
    const maxPossiblePoints = numProposals * rankedVotes.length * numProposals;

    return {
      winner,
      winnerProposal,
      strategy: VOTING_STRATEGY.RANKED_CHOICE,
      scores,
      totalVotes: rankedVotes.length,
      confidence: maxPoints / maxPossiblePoints
    };
  }

  /**
   * Execute voting with specified strategy
   * @param {String} strategy - Voting strategy to use
   * @param {Array} proposals - Proposals to vote on
   * @param {Array} votes - Votes cast by agents
   * @returns {Object} Voting results
   */
  static execute(strategy, proposals, votes) {
    logger.info(`Executing voting with strategy: ${strategy}`);

    try {
      switch (strategy) {
        case VOTING_STRATEGY.MAJORITY:
          return this.majority(proposals, votes);

        case VOTING_STRATEGY.WEIGHTED:
          return this.weighted(proposals, votes);

        case VOTING_STRATEGY.CONSENSUS:
          return this.consensus(proposals, votes);

        case VOTING_STRATEGY.RANKED_CHOICE:
          return this.rankedChoice(proposals, votes);

        default:
          logger.warn(`Unknown voting strategy: ${strategy}, using majority`);
          return this.majority(proposals, votes);
      }
    } catch (error) {
      logger.error('Voting execution error:', error);
      throw error;
    }
  }
}

/**
 * Format voting results for display
 */
function formatVotingResults(results) {
  let output = `\n=== Voting Results ===\n`;
  output += `Strategy: ${results.strategy}\n`;
  output += `Winner: ${results.winnerProposal ? results.winnerProposal.content.substring(0, 100) : 'None'}...\n`;
  output += `Confidence: ${(results.confidence * 100).toFixed(1)}%\n`;
  output += `Total Votes: ${results.totalVotes}\n`;

  if (results.strategy === VOTING_STRATEGY.CONSENSUS) {
    output += `Consensus: ${results.hasConsensus ? '✓ Yes' : '✗ No'}\n`;
    output += `${results.message}\n`;
  }

  output += `\n--- Vote Breakdown ---\n`;

  if (results.voteCounts) {
    Object.entries(results.voteCounts).forEach(([id, counts]) => {
      output += `\nProposal ${id}:\n`;
      output += `  Upvotes: ${counts.upvotes}\n`;
      output += `  Downvotes: ${counts.downvotes}\n`;
      output += `  Abstain: ${counts.abstain}\n`;
    });
  } else if (results.scores) {
    Object.entries(results.scores).forEach(([id, data]) => {
      output += `\nProposal ${id}:\n`;
      if (data.score !== undefined) {
        output += `  Score: ${data.score.toFixed(2)}\n`;
      }
      if (data.totalPoints !== undefined) {
        output += `  Points: ${data.totalPoints}\n`;
      }
    });
  }

  return output;
}

module.exports = {
  VotingSystem,
  VOTE_TYPE,
  VOTING_STRATEGY,
  formatVotingResults
};
