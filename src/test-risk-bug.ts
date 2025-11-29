import { createHeimgeist } from './core';
import { EventType, ChronikEvent } from './types';

async function testBug() {
  const heimgeist = createHeimgeist();
  
  // Process a CI failure event which creates MEDIUM severity insight
  const event: ChronikEvent = {
    id: 'test-1',
    type: EventType.CIResult,
    timestamp: new Date(),
    source: 'test-ci',
    payload: { status: 'failed' }
  };
  
  const insights = await heimgeist.processEvent(event);
  console.log('Generated insights:', insights.length);
  console.log('Insight severity:', insights[0]?.severity);
  console.log('Insight title:', insights[0]?.title);
  
  // Get risk assessment
  const assessment = heimgeist.getRiskAssessment();
  console.log('\nRisk Assessment:');
  console.log('Level:', assessment.level);
  console.log('Reasons:', assessment.reasons);
  
  console.log('\n=== BUG DETECTED ===');
  console.log('Expected risk level: medium (because we have a medium-severity insight)');
  console.log('Actual risk level:', assessment.level);
  console.log('\nThe getRiskAssessment() function does not check for medium severity insights!');
  console.log('It only checks: critical, high, pending actions, or defaults to low');
}

testBug();
