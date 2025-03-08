import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { assert } from "chai";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { NftProgram } from "../target/types/nft_program";
import { PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";

describe("NFT Marketplace Lifecycle Tests", () => {
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

  const fundAccounts = async (...accounts: Keypair[]) => {
    for (const account of accounts) {
      const tx = await provider.connection.requestAirdrop(
        account.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(tx);
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
        .rpc();
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

  before(async () => {
    // Fund all accounts for test sequences
    await fundAccounts(
      payer1, buyer1, buyer2, creator1,
      payer2, buyer3, buyer4, creator2,
      payer3, buyer5, buyer6, creator3
    );
  });

  describe("Test Sequence 1", () => {
    executeFullNFTLifecycle(mint1, creator1, payer1, buyer1, buyer2, "Sequence 1");
  });

  describe("Test Sequence 2", () => {
    executeFullNFTLifecycle(mint2, creator2, payer2, buyer3, buyer4, "Sequence 2");
  });

  describe("Test Sequence 3", () => {
    executeFullNFTLifecycle(mint3, creator3, payer3, buyer5, buyer6, "Sequence 3");
  });
});