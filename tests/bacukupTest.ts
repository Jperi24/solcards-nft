import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import { assert } from "chai";
import { NftProgram } from "../target/types/nft_program";
import { PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

describe("mint_nft", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftProgram as Program<NftProgram>;

  // Keypairs for accounts
  const payer = Keypair.generate();
  const mint = Keypair.generate();
  const creator = Keypair.generate();

  // PDA for the stats account
  let statsAccountPda: PublicKey;
  let statsAccountBump: number;

  before(async () => {
    console.log("\nInitial Setup:");
    console.log("Payer Public Key:", payer.publicKey.toString());
    console.log("Mint Public Key:", mint.publicKey.toString());
    console.log("Creator Public Key:", creator.publicKey.toString());

    // Derive PDA for stats account
    [statsAccountPda, statsAccountBump] = await PublicKey.findProgramAddress(
      [Buffer.from("stats"), mint.publicKey.toBuffer()],
      program.programId
    );
    console.log("Stats Account PDA:", statsAccountPda.toString());
    console.log("Stats Account Bump:", statsAccountBump);

    // Fund payer account
    const tx = await provider.connection.requestAirdrop(
      payer.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(tx, "confirmed");

    const creatorTx = await provider.connection.requestAirdrop(
      creator.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(creatorTx, "confirmed");

    // Log balances
    const payerBalance = await provider.connection.getBalance(payer.publicKey);
    const creatorBalance = await provider.connection.getBalance(creator.publicKey);
    console.log("\nAccount Balances:");
    console.log("Payer Balance:", payerBalance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    console.log("Creator Balance:", creatorBalance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
  });

  it("Mints an NFT", async () => {
    try {
      // Derive associated token account for the mint
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        payer.publicKey
      );
      console.log("\nToken Account:", tokenAccount.toString());

      // Prepare input data
      const name = "My NFT";
      const symbol = "MYNFT";
      const uri = "https://example.com/nft-metadata.json";
      const stats = {
        mint: mint.publicKey,
        attack: 80,
        defense: 60,
        element: { dank: {} },
        rarity: { common: {} },
      };

      // Metadata and Master Edition PDAs
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

      console.log("\nPDAs:");
      console.log("Metadata PDA:", metadataPda.toString());
      console.log("Master Edition PDA:", masterEditionPda.toString());

      console.log("\nExecuting mint_nft instruction...");
      const txSignature = await program.methods
        .mintNft(name, symbol, uri, stats)
        .accountsStrict({
          payer: payer.publicKey,
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
        .signers([payer, mint, creator])
        .rpc();

      console.log("Transaction signature:", txSignature);

      // Check mint account state after minting
      const mintInfo = await getMint(provider.connection, mint.publicKey);
      console.log("\nMint Account State:");
      console.log("Mint Authority:", mintInfo.mintAuthority?.toString());
      console.log("Freeze Authority:", mintInfo.freezeAuthority?.toString());
      console.log("Supply:", mintInfo.supply.toString());
      console.log("Decimals:", mintInfo.decimals);

      // Fetch and verify stats account
      console.log("\nVerifying stats account...");
      const statsAccount = await program.account.cardStats.fetch(statsAccountPda);
      console.log("Stats Account Data:", {
        mint: statsAccount.mint.toString(),
        attack: statsAccount.attack,
        defense: statsAccount.defense,
        element: statsAccount.element,
        rarity: statsAccount.rarity,
      });

      // Verify token account
      const tokenAccountInfo = await provider.connection.getAccountInfo(tokenAccount);
      console.log("\nToken Account Info:");
      console.log("Exists:", tokenAccountInfo !== null);
      if (tokenAccountInfo) {
        console.log("Data Length:", tokenAccountInfo.data.length);
        console.log("Owner:", tokenAccountInfo.owner.toString());
        console.log("Lamports:", tokenAccountInfo.lamports);
      }

      // Run assertions
      assert.strictEqual(statsAccount.mint.toString(), mint.publicKey.toString());
      assert.strictEqual(statsAccount.attack, stats.attack);
      assert.strictEqual(statsAccount.defense, stats.defense);
      assert.deepEqual(statsAccount.element, stats.element);
      assert.deepEqual(statsAccount.rarity, stats.rarity);
      assert.isNotNull(tokenAccountInfo, "Token account was not created");

    } catch (error) {
      console.error("\nError Details:");
      console.error("Error:", error);
      if ('logs' in error) {
        console.error("\nProgram Logs:");
        console.error(error.logs);
      }
      throw error;
    }
  });
});