import { NextResponse } from "next/server";
import { PinataSDK } from "pinata-web3";

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.PINATA_GATEWAY!,
});

export async function POST(req: Request) {
  try {
    const { ipfsHashes } = await req.json();
    if (!ipfsHashes || !Array.isArray(ipfsHashes)) {
      return NextResponse.json(
        { error: "Invalid request format" },
        { status: 400 }
      );
    }

    const metadataList = [];

    for (const ipfsHash of ipfsHashes) {
      try {
        const response = await pinata.gateways.get(ipfsHash);

        // ✅ Ensure response is correctly formatted
        if (response && response.data) {
          let metadata;

          // ✅ If response.data is an object, use it directly
          if (typeof response.data === "object") {
            metadata = { ...response.data };
          }
          // ✅ If response.data is a string, attempt JSON parsing
          else if (typeof response.data === "string") {
            try {
              metadata = JSON.parse(response.data);
            } catch (parseError) {
              console.warn(
                `❗ Failed to parse JSON for ${ipfsHash}:`,
                parseError
              );
              continue;
            }
          } else {
            console.warn(`❗ Unexpected data format for ${ipfsHash}`);
            continue;
          }

          // ✅ Replace `ipfs://` with `https://gateway/...`
          if (
            metadata.image &&
            typeof metadata.image === "string" &&
            metadata.image.startsWith("ipfs://")
          ) {
            metadata.image = metadata.image.replace(
              "ipfs://",
              "https://" + process.env.PINATA_GATEWAY + "/ipfs/"
            );
          }

          metadataList.push(metadata); // Store the updated metadata object
        }
      } catch (error) {
        console.error(`🚨 Error fetching metadata for ${ipfsHash}:`, error);
      }
    }

    return NextResponse.json(metadataList);
  } catch (error) {
    console.error("🚨 Error reading Pinata metadata:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
