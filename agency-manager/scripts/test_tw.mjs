import { compile } from 'tailwindcss';

async function test() {
  const compiler = await compile('@import "tailwindcss";');
  console.log('Result for p-3.5:', JSON.stringify(compiler.build(['p-3.5'])));
  console.log('Result for p-4:', JSON.stringify(compiler.build(['p-4'])));
  console.log('Result for p-5:', JSON.stringify(compiler.build(['p-5'])));
}

test().catch(console.error);
