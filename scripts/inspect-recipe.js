import { generateRecipe } from '../pipeline.js';

if (process.argv.length !== 3) {
  console.error('Usage: npm run recipe -- "object-123"');
  process.exitCode = 1;
} else {
  try {
    console.log(JSON.stringify(generateRecipe(process.argv[2]), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
