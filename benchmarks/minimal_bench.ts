
async function sequentialExecution(tasks) {
  const results = [];
  for (const task of tasks) {
    results.push(await task());
  }
  return results;
}

async function concurrentExecution(tasks) {
  return await Promise.all(tasks.map(task => task()));
}

async function chunkedExecution(tasks, size) {
  const results = [];
  for (let i = 0; i < tasks.length; i += size) {
    const chunk = tasks.slice(i, i + size);
    const chunkResults = await Promise.all(chunk.map(task => task()));
    results.push(...chunkResults);
  }
  return results;
}

async function runBenchmark() {
  const TASK_COUNT = 10;
  const DELAY_MS = 100;

  console.log(`--- Performance Model Benchmark ---`);
  console.log(`Tasks: ${TASK_COUNT}, Delay: ${DELAY_MS}ms per task\n`);

  const createTasks = () => Array.from({ length: TASK_COUNT }, (_, i) => async () => {
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    return `result-${i}`;
  });

  // Sequential
  let start = Date.now();
  await sequentialExecution(createTasks());
  let durationSeq = Date.now() - start;
  console.log(`Sequential: ${durationSeq}ms`);

  // Concurrent (Promise.all)
  start = Date.now();
  await concurrentExecution(createTasks());
  let durationCon = Date.now() - start;
  console.log(`Concurrent: ${durationCon}ms`);

  // Chunked (size 4)
  start = Date.now();
  await chunkedExecution(createTasks(), 4);
  let durationChunk = Date.now() - start;
  console.log(`Chunked (4): ${durationChunk}ms`);

  console.log(`\nTheoretical Improvement (Concurrent): ${((durationSeq / durationCon)).toFixed(2)}x faster`);
}

runBenchmark().catch(console.error);
