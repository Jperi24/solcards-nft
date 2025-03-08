import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { NftProgram } from "../target/types/nft_program";
import { PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
import { describe, it, before } from 'mocha';

describe("NFT Marketplace Lifecycle Tests", () => {
  before(async () => {
    console.log("beginning funding:::GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")    
    // First fund the provider wallet if needed
    if ((await provider.connection.getBalance(provider.wallet.publicKey)) < 5 * anchor.web3.LAMPORTS_PER_SOL) {
      const airdropSig = await provider.connection.requestAirdrop(
        provider.wallet.publicKey,
        5 * anchor.web3.LAMPORTS_PER_SOL
      );
      await confirmTx(airdropSig);
    }
  
    // Fund test accounts in smaller batches
    console.log("Funding first batch of accounts...");
    await fundAccounts(payer1, buyer1, buyer2, creator1);
    
    console.log("Funding second batch of accounts...");
    await fundAccounts(payer2, buyer3, buyer4, creator2);
    
    console.log("Funding third batch of accounts...");
    await fundAccounts(payer3, buyer5, buyer6, creator3);

    const accountsToCheck = [
      payer1, buyer1, buyer2, creator1,
      payer2, buyer3, buyer4, creator2,
      payer3, buyer5, buyer6, creator3
    ];
  
    console.log("\nFinal Account Balance Check:");
    for (const account of accountsToCheck) {
      const balance = await provider.connection.getBalance(account.publicKey);
      console.log(`${account.publicKey}: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
    }
    
    // Add a delay before proceeding
    await new Promise(resolve => setTimeout(resolve, 2000));
  });
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.NftProgram as Program<NftProgram>;

  // Test sequence 1 accounts
  const payer1 = Keypair.generate();
  const buyer1 = Keypair.generate();
  const buyer2 = Keypair.generate();
  const mint1 = Keypair.generate();
  const creator1 = Keypair.generate();

  // Test sequence 2 accounts
  const payer2 = Keypair.generate();
  const buyer3 = Keypair.generate();
  const buyer4 = Keypair.generate();
  const mint2 = Keypair.generate();
  const creator2 = Keypair.generate();

  // Test sequence 3 accounts
  const payer3 = Keypair.generate();
  const buyer5 = Keypair.generate();
  const buyer6 = Keypair.generate();
  const mint3 = Keypair.generate();
  const creator3 = Keypair.generate();

  const confirmTx = async (signature: string) => {
    try {
      const latestBlockHash = await provider.connection.getLatestBlockhash();
      return await provider.connection.confirmTransaction({
        signature,
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      });
    } catch (error) {
      console.error("Confirmation failed for signature:", signature);
      throw error;
    }
  };

  const fundAccounts = async (...accounts: Keypair[]) => {
    const MAX_RETRIES = 5; // Increased retries
    const AIRDROP_AMOUNT = 10 * anchor.web3.LAMPORTS_PER_SOL; // Increased to 10 SOL
    
    for (const account of accounts) {
      let success = false;
      let attempts = 0;
      
      while (!success && attempts < MAX_RETRIES) {
        try {
          attempts++;
          console.log(`Funding attempt ${attempts} for ${account.publicKey}`);
          
          const airdropTx = await provider.connection.requestAirdrop(
            account.publicKey,
            AIRDROP_AMOUNT
          );
          await confirmTx(airdropTx);
          
          // Additional check with timeout
          let balance = 0;
          let checks = 0;
          while (balance < AIRDROP_AMOUNT && checks < 5) {
            balance = await provider.connection.getBalance(account.publicKey);
            if (balance < AIRDROP_AMOUNT) {
              await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s
              checks++;
            }
          }
          
          if (balance >= AIRDROP_AMOUNT) {
            success = true;
            console.log(`Funded ${account.publicKey}: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
          } else {
            console.log(`Insufficient balance after airdrop, retrying...`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Longer delay
          }
        } catch (error) {
          console.error(`Airdrop failed: ${error}`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      
      if (!success) {
        throw new Error(`Failed to fund account ${account.publicKey} after ${MAX_RETRIES} attempts`);
      }
    }
  };

  const verifyNftOwnership = async (tokenAccount: PublicKey, expectedAmount: number) => {
    const balance = await provider.connection.getTokenAccountBalance(tokenAccount);
    assert.equal(parseInt(balance.value.amount), expectedAmount, "NFT ownership verification failed");
  };

  

  async function executeFullNFTLifecycle(
    mint: Keypair,
    creator: Keypair,
    initialOwner: Keypair,
    firstBuyer: Keypair,
    secondBuyer: Keypair,
    testPrefix: string
  ) {
    const accounts = [mint,creator,initialOwner,firstBuyer,secondBuyer]

    for (const account of accounts){
      console.log(`THIS IS THE INFO FOR ${account}`,account)
    }
    
    
    
    let statsAccountPda: PublicKey;
    let statsAccountBump: number;

    // Derive PDA for stats account
    [statsAccountPda, statsAccountBump] = await PublicKey.findProgramAddress(
      [Buffer.from("stats"), mint.publicKey.toBuffer()],
      program.programId
    );

    it(`${testPrefix} - Initial NFT Minting`, async () => {
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        initialOwner.publicKey
      );

      const [metadataPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          PROGRAM_ID.toBuffer(),
          mint.publicKey.toBuffer(),
        ],
        PROGRAM_ID
      );

      const [masterEditionPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          PROGRAM_ID.toBuffer(),
          mint.publicKey.toBuffer(),
          Buffer.from("edition"),
        ],
        PROGRAM_ID
      );

      await program.methods
        .mintNft(
          "Test NFT",
          "TNFT",
          "https://example.com/nft.json",
          {
            mint: mint.publicKey,
            attack: 80,
            defense: 60,
            element: { dank: {} },
            rarity: { common: {} },
          }
        )
        .accountsStrict({
          payer: initialOwner.publicKey,
          statsAccount: statsAccountPda,
          mint: mint.publicKey,
          metadata: metadataPda,
          masterEdition: masterEditionPda,
          tokenAccount,
          creator: creator.publicKey,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          metadataProgram: PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([initialOwner, mint, creator])
        .rpc();

      await verifyNftOwnership(tokenAccount, 1);
    });

    // First owner lists NFT
    it(`${testPrefix} - First Owner Lists NFT`, async () => {
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        initialOwner.publicKey
      );

      const [listingPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.publicKey.toBuffer()],
        program.programId
      );

      const listPrice = new anchor.BN(1_000_000_000);
      await program.methods
        .listNft(listPrice)
        .accountsStrict({
          seller: initialOwner.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          tokenAccount: tokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([initialOwner])
        .rpc({
          
        });
    });

    // Update listing price
    it(`${testPrefix} - First Owner Updates Listing`, async () => {
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        initialOwner.publicKey
      );

      const [listingPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.publicKey.toBuffer()],
        program.programId
      );

      const newPrice = new anchor.BN(1_500_000_000);
      await program.methods
        .updateListing(newPrice)
        .accountsStrict({
          seller: initialOwner.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          tokenAccount: tokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([initialOwner])
        .rpc();
    });

    // Cancel listing
    it(`${testPrefix} - First Owner Cancels Listing`, async () => {
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        initialOwner.publicKey
      );

      const [listingPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .cancelListing()
        .accountsStrict({
          seller: initialOwner.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          tokenAccount: tokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([initialOwner])
        .rpc();
    });

    // List again and complete first purchase
    it(`${testPrefix} - First Owner Lists Again and First Buyer Purchases`, async () => {
      const sellerTokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        initialOwner.publicKey
      );
      const buyerTokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        firstBuyer.publicKey
      );

      const [listingPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.publicKey.toBuffer()],
        program.programId
      );

      // List again
      const listPrice = new anchor.BN(1_000_000_000);
      await program.methods
        .listNft(listPrice)
        .accountsStrict({
          seller: initialOwner.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          tokenAccount: sellerTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([initialOwner])
        .rpc();

      // Purchase
      await program.methods
        .purchaseNft()
        .accountsStrict({
          buyer: firstBuyer.publicKey,
          seller: initialOwner.publicKey,
          creator: creator.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          sellerToken: sellerTokenAccount,
          buyerToken: buyerTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([firstBuyer])
        .rpc();

      // Verify ownership transfer
      await verifyNftOwnership(buyerTokenAccount, 1);
      await verifyNftOwnership(sellerTokenAccount, 0);
    });

    // Second owner (first buyer) lists NFT
    it(`${testPrefix} - Second Owner Lists NFT`, async () => {
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        firstBuyer.publicKey
      );

      const [listingPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.publicKey.toBuffer()],
        program.programId
      );

      const listPrice = new anchor.BN(2_000_000_000);
      await program.methods
        .listNft(listPrice)
        .accountsStrict({
          seller: firstBuyer.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          tokenAccount: tokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([firstBuyer])
        .rpc();
    });

    // Second owner updates listing
    it(`${testPrefix} - Second Owner Updates Listing`, async () => {
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        firstBuyer.publicKey
      );

      const [listingPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.publicKey.toBuffer()],
        program.programId
      );

      const newPrice = new anchor.BN(2_500_000_000);
      await program.methods
        .updateListing(newPrice)
        .accountsStrict({
          seller: firstBuyer.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          tokenAccount: tokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([firstBuyer])
        .rpc();
    });

    // Second owner cancels listing
    it(`${testPrefix} - Second Owner Cancels Listing`, async () => {
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        firstBuyer.publicKey
      );

      const [listingPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .cancelListing()
        .accountsStrict({
          seller: firstBuyer.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          tokenAccount: tokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([firstBuyer])
        .rpc();
    });

    // Second owner lists again and sells to third owner
    it(`${testPrefix} - Second Owner Lists Again and Third Owner Purchases`, async () => {
      const sellerTokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        firstBuyer.publicKey
      );
      const buyerTokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        secondBuyer.publicKey
      );

      const [listingPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.publicKey.toBuffer()],
        program.programId
      );

      // List again
      const listPrice = new anchor.BN(2_000_000_000);
      await program.methods
        .listNft(listPrice)
        .accountsStrict({
          seller: firstBuyer.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          tokenAccount: sellerTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([firstBuyer])
        .rpc();

      // Purchase
      await program.methods
        .purchaseNft()
        .accountsStrict({
          buyer: secondBuyer.publicKey,
          seller: firstBuyer.publicKey,
          creator: creator.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          sellerToken: sellerTokenAccount,
          buyerToken: buyerTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([secondBuyer])
        .rpc();

      // Verify final ownership
      await verifyNftOwnership(buyerTokenAccount, 1);
      await verifyNftOwnership(sellerTokenAccount, 0);
    });
  }

  

  
  describe("Test Sequence 1: Full Lifecycle for Mint1", async () => {
    before(async () => {
      console.log("beginning funding:::GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")    
      // First fund the provider wallet if needed
      if ((await provider.connection.getBalance(provider.wallet.publicKey)) < 5 * anchor.web3.LAMPORTS_PER_SOL) {
        const airdropSig = await provider.connection.requestAirdrop(
          provider.wallet.publicKey,
          5 * anchor.web3.LAMPORTS_PER_SOL
        );
        await confirmTx(airdropSig);
      }
    
      // Fund test accounts in smaller batches
      console.log("Funding first batch of accounts...");
      await fundAccounts(payer1, buyer1, buyer2, creator1);
      
      console.log("Funding second batch of accounts...");
      await fundAccounts(payer2, buyer3, buyer4, creator2);
      
      console.log("Funding third batch of accounts...");
      await fundAccounts(payer3, buyer5, buyer6, creator3);
  
      const accountsToCheck = [
        payer1, buyer1, buyer2, creator1,
        payer2, buyer3, buyer4, creator2,
        payer3, buyer5, buyer6, creator3
      ];
    
      console.log("\nFinal Account Balance Check:");
      for (const account of accountsToCheck) {
        const balance = await provider.connection.getBalance(account.publicKey);
        console.log(`${account.publicKey}: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
      }
      
      // Add a delay before proceeding
      await new Promise(resolve => setTimeout(resolve, 2000));
    });
    await executeFullNFTLifecycle(mint1, creator1, payer1, buyer1, buyer2, "Test Sequence 1");
  });

  describe("Test Sequence 2: Full Lifecycle for Mint2", async () => {
    before(async () => {
      console.log("beginning funding:::GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")    
      // First fund the provider wallet if needed
      if ((await provider.connection.getBalance(provider.wallet.publicKey)) < 5 * anchor.web3.LAMPORTS_PER_SOL) {
        const airdropSig = await provider.connection.requestAirdrop(
          provider.wallet.publicKey,
          5 * anchor.web3.LAMPORTS_PER_SOL
        );
        await confirmTx(airdropSig);
      }
    
      // Fund test accounts in smaller batches
      console.log("Funding first batch of accounts...");
      await fundAccounts(payer1, buyer1, buyer2, creator1);
      
      console.log("Funding second batch of accounts...");
      await fundAccounts(payer2, buyer3, buyer4, creator2);
      
      console.log("Funding third batch of accounts...");
      await fundAccounts(payer3, buyer5, buyer6, creator3);
  
      const accountsToCheck = [
        payer1, buyer1, buyer2, creator1,
        payer2, buyer3, buyer4, creator2,
        payer3, buyer5, buyer6, creator3
      ];
    
      console.log("\nFinal Account Balance Check:");
      for (const account of accountsToCheck) {
        const balance = await provider.connection.getBalance(account.publicKey);
        console.log(`${account.publicKey}: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
      }
      
      // Add a delay before proceeding
      await new Promise(resolve => setTimeout(resolve, 2000));
    });
    await executeFullNFTLifecycle(mint2, creator2, payer2, buyer3, buyer4, "Test Sequence 2");
  });

  describe("Test Sequence 3: Full Lifecycle for Mint3", async () => {
    before(async () => {
      console.log("beginning funding:::GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")    
      // First fund the provider wallet if needed
      if ((await provider.connection.getBalance(provider.wallet.publicKey)) < 5 * anchor.web3.LAMPORTS_PER_SOL) {
        const airdropSig = await provider.connection.requestAirdrop(
          provider.wallet.publicKey,
          5 * anchor.web3.LAMPORTS_PER_SOL
        );
        await confirmTx(airdropSig);
      }
    
      // Fund test accounts in smaller batches
      console.log("Funding first batch of accounts...");
      await fundAccounts(payer1, buyer1, buyer2, creator1);
      
      console.log("Funding second batch of accounts...");
      await fundAccounts(payer2, buyer3, buyer4, creator2);
      
      console.log("Funding third batch of accounts...");
      await fundAccounts(payer3, buyer5, buyer6, creator3);
  
      const accountsToCheck = [
        payer1, buyer1, buyer2, creator1,
        payer2, buyer3, buyer4, creator2,
        payer3, buyer5, buyer6, creator3
      ];
    
      console.log("\nFinal Account Balance Check:");
      for (const account of accountsToCheck) {
        const balance = await provider.connection.getBalance(account.publicKey);
        console.log(`${account.publicKey}: ${balance / anchor.web3.LAMPORTS_PER_SOL} SOL`);
      }
      
      // Add a delay before proceeding
      await new Promise(resolve => setTimeout(resolve, 2000));
    });
    await executeFullNFTLifecycle(mint3, creator3, payer3, buyer5, buyer6, "Test Sequence 3");
  });
});