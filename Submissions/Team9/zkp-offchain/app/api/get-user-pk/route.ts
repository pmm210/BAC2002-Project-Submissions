import { NextApiRequest, NextApiResponse } from "next";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { studentId } = req.body;
  const circuitPath = path.join(process.cwd(), "circuits");

  try {
    execSync(`zokrates compute-witness -a ${studentId}`, { cwd: circuitPath });
    execSync(`zokrates generate-proof`, { cwd: circuitPath });

    const proofRaw = fs.readFileSync(path.join(circuitPath, "proof.json"), "utf8");
    const { proof, inputs } = JSON.parse(proofRaw);

    const a = [proof.a[0], proof.a[1]];
    const b = [
      [proof.b[0][0], proof.b[0][1]],
      [proof.b[1][0], proof.b[1][1]]
    ];
    const c = [proof.c[0], proof.c[1]];

    return res.status(200).json({ success: true, a, b, c, input: inputs });
  } catch (err) {
    console.error("ZKP generation error:", err);
    return res.status(500).json({ success: false });
  }
}