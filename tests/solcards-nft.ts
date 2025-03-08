import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NftProgram } from "../target/types/nft_program";
import { ComputeBudgetProgram } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Keypair,
} from "@solana/web3.js";
import {
  PROGRAM_ID as TOKEN_METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
  createCreateMasterEditionV3Instruction,
  isCollectionDetailsToggleClear,
} from "@metaplex-foundation/mpl-token-metadata";

describe("nft_program", () => {

  

// The byte array from your Rust code
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const COLLECTION_AUTHORITY = provider.wallet.publicKey;

  

  const program = anchor.workspace.NftProgram as Program<NftProgram>;
  
  // Test Collection Data
  const collectionName = "Test Collection";
  const collectionSymbol = "TEST";
  const collectionUri = "https://test.com/collection.json";

  // Test NFT Data
  const nftName = "Test NFT";
  const nftSymbol = "TNFT";
  const nftUri = "https://test.com/nft.json";

  // Store important keypairs
  let collectionMint: Keypair;
  let nftMint: Keypair;

  before(async () => {
    // Generate new keypair for collection mint
    collectionMint = Keypair.generate();
  });

  it("Can create a collection", async () => {

    const bytes = [
      222, 250, 88, 27, 182, 219, 236, 79, 16, 183, 187, 226, 207, 169, 201, 159, 
      2, 144, 44, 84, 55, 145, 166, 31, 193, 157, 36, 6, 64, 119, 54, 33
    ];
    
    // Convert to Uint8Array
    const uint8Array = new Uint8Array(bytes);
    
    // Create a PublicKey from the bytes
    const pubkey = new PublicKey(uint8Array);
    
    // Convert to base58 string representation
    console.log("Public Key:", pubkey.toString());

    console.log("Current Collection Authority",COLLECTION_AUTHORITY)
    
    // Get PDA addresses for metadata and master edition
    const [collectionMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        collectionMint.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const [collectionMasterEdition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        collectionMint.publicKey.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    // Get associated token account for collection
    const collectionTokenAccount = await getAssociatedTokenAddress(
      collectionMint.publicKey,
      provider.wallet.publicKey
    );

    try {
      const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ 
        units: 300000 
    });
      // Create collection
      await program.methods
        .createCollection(collectionName, collectionSymbol, collectionUri).preInstructions([modifyComputeUnits])  
        .accountsStrict({
          payer: provider.wallet.publicKey,
          collectionAuthority: COLLECTION_AUTHORITY,
          collectionMint: collectionMint.publicKey,
          collectionTokenAccount: collectionTokenAccount,
          collectionMetadata: collectionMetadata,
          collectionMasterEdition: collectionMasterEdition,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          metadataProgram: TOKEN_METADATA_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([collectionMint])
        .rpc();

      console.log("Collection created successfully!");
    } catch (error) {
      console.error("Error creating collection:", error);
      throw error;
    }
  });

  it("Can mint an NFT", async () => {

    console.log("Token MEtadata_program",TOKEN_METADATA_PROGRAM_ID)
    // Generate new keypair for NFT mint
    nftMint = Keypair.generate();
    const payer = Keypair.generate();
    const tx = await provider.connection.requestAirdrop(
      payer.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    
    await provider.connection.confirmTransaction(tx, "confirmed");

    const tx2 = await provider.connection.requestAirdrop(
      nftMint.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    
    await provider.connection.confirmTransaction(tx2, "confirmed");

    // Get PDA addresses for metadata and master edition
    const [metadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        nftMint.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const [masterEdition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        nftMint.publicKey.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

   

    // Get associated token account for NFT
    const tokenAccount = await getAssociatedTokenAddress(
      nftMint.publicKey,
      payer.publicKey  // This MUST match the payer you're passing to the instruction
    );

    // Get collection metadata and master edition
    const [collectionMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        collectionMint.publicKey.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const [collectionMasterEdition] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        collectionMint.publicKey.toBuffer(),
        Buffer.from("edition"),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );

    const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({ 
      units: 300000 
  });

  const stats = {
    mint: nftMint.publicKey,
    attack: 80,
    defense: 60,
    element: { toxic: {} },
    rarity: { common: {} },
  };

    // Get stats account PDA
    const [statsAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("stats"), nftMint.publicKey.toBuffer()],
      program.programId
    );
    

    try {

      // Log important constants
console.log("Program ID:", program.programId.toString());
console.log("COLLECTION_AUTHORITY in test:", COLLECTION_AUTHORITY.toString());
console.log("Hardcoded COLLECTION_AUTHORITY in Rust:", "DE:FA:58:1B:B6:DB:EC:4F:10:B7:BB:E2:CF:A9:C9:9F:02:90:2C:54:37:91:A6:1F:C1:9D:24:06:40:77:36:21");

// Make sure these match!
      
      console.log("payer", payer.publicKey.toString())
      console.log("statsAccount", statsAccount.toString())
      console.log("mint", nftMint.publicKey.toString())
      console.log("metadata", metadata.toString())
      console.log("masterEdition", masterEdition.toString())
      console.log("tokenAccount", tokenAccount.toString())
      console.log("tokenProgram", TOKEN_PROGRAM_ID.toString())
      console.log("associatedTokenProgram", ASSOCIATED_TOKEN_PROGRAM_ID.toString())
      console.log("metadataProgram", TOKEN_METADATA_PROGRAM_ID.toString())
      console.log("systemProgram", SystemProgram.programId.toString())
      console.log("rent", SYSVAR_RENT_PUBKEY.toString())
      console.log("collectionMint", collectionMint.publicKey.toString())
      console.log("collectionMetadata", collectionMetadata.toString())
      console.log("collectionMasterEdition", collectionMasterEdition.toString())
      console.log("collectionAuthority", COLLECTION_AUTHORITY.toString())
            // Mint NFT
      
      await program.methods
        .mintNft(
          nftName,
          nftSymbol,
          nftUri,
          stats,
        ).preInstructions([modifyComputeUnits])  
        .accountsStrict({
          payer: payer.publicKey,
          statsAccount: statsAccount,
          mint: nftMint.publicKey,
          metadata: metadata,
          masterEdition: masterEdition,
          tokenAccount: tokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          metadataProgram: TOKEN_METADATA_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
          collectionMint: collectionMint.publicKey,
          collectionMetadata: collectionMetadata,
          collectionMasterEdition: collectionMasterEdition,
          collectionAuthority: COLLECTION_AUTHORITY,
        })
        .signers([nftMint,payer])
        .rpc();

     

      // Verify stats account data
      const statsAccountData = await program.account.cardStats.fetch(statsAccount);
      console.log("NFT Stats:", statsAccountData);
    } catch (error) {
      console.error("Error minting NFT:", error);
      
      // Extract and display the logs from the error
      if (error.logs) {
        console.log("\nDetailed Transaction Logs:");
        error.logs.forEach((log, i) => {
          console.log(`${i}: ${log}`);
        });
      }
      
     
      
      throw error;
    }
  });
});