// app/api/generate-proof/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { studentId } = await req.json();

    const circuitsPath = path.join(process.cwd(), 'circuits');


    // 🧹 Clean up old files (Windows safe)
    try {
        fs.unlinkSync(path.join(circuitsPath, 'proof.json'));
    } catch (e) {
        console.warn('⚠️ proof.json not found, skipping');
    }
    
    try {
        fs.unlinkSync(path.join(circuitsPath, 'witness'));
    } catch (e) {
        console.warn('⚠️ witness file not found, skipping');
    }
  
    // 1. Compute witness
    const witnessArgs = `${parseInt(studentId)} 1000 5000`;  // force convert
    execSync(`zokrates compute-witness -a ${witnessArgs}`, { cwd: circuitsPath });
    //execSync(`zokrates compute-witness -a ${studentId} 1000 5000`, { cwd: circuitsPath });


    // After computing witness, print the circruit result (proof return value)
    // Help to confirm if the ZoKrates return value is 0 or 1, and we can trace why invalid inputs are still passing
    // const witnessOut = fs.readFileSync(path.join(circuitsPath, 'witness'), 'utf-8');
    // console.log("🧪 Witness Output:\n", witnessOut);


    // 2. Generate proof
    execSync(`zokrates generate-proof`, { cwd: circuitsPath });

    // 3. Read proof.json
    const proofFile = fs.readFileSync(path.join(circuitsPath, 'proof.json'), 'utf-8');
    console.log("✅ proof.json:", proofFile)
    const proof = JSON.parse(proofFile);

    // 4. Convert proof format to match Solidity
    const a = [proof.proof.a[0], proof.proof.a[1]];
    const b = [
      [proof.proof.b[0][0], proof.proof.b[0][1]],
      [proof.proof.b[1][0], proof.proof.b[1][1]],
    ];
    const c = [proof.proof.c[0], proof.proof.c[1]];
    const input = proof.inputs;
    console.log("Generated proof input:", input);

    return NextResponse.json({ success: true, a, b, c, input });
  } catch (error: any) {
    console.error('❌ ZKP generation failed:', error);
    return NextResponse.json({ success: false, error: error.message || 'Unknown error' }, { status: 500 });
  }
}
