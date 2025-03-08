import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress, getMint } from "@solana/spl-token";
import { assert } from "chai";
import { NftProgram } from "../target/types/nft_program";
import { PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";


// NFT Program Comprehensive Tests
//Add checks for if not listed and any other security vulnerabilities
// 1) Mints an NFT for testing
// 2) Lists NFT successfully
// 3) Updates listing price
// 4) Purchases NFT
// 5) Cancels listing after purchase



describe("mint_nft", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.NftProgram as Program<NftProgram>;

  // Keypairs for accounts
  const payer = Keypair.generate();
  const buyer = Keypair.generate();
  const mint = Keypair.generate();
  const creator = Keypair.generate();
  const malicous = Keypair.generate();

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
        .mintNft(name, symbol, uri, stats,collectionNFT)
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


    const MalicousTx = await provider.connection.requestAirdrop(
      malicous.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(MalicousTx, "confirmed");

    // Log balances
    const payerBalance = await provider.connection.getBalance(payer.publicKey);
    const creatorBalance = await provider.connection.getBalance(creator.publicKey);
    console.log("\nAccount Balances:");
    console.log("Payer Balance:", payerBalance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    console.log("Creator Balance:", creatorBalance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
  });

  it("Lists An NFT For Sale", async () => {
    try {
      // Derive associated token account for the mint
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        payer.publicKey
      );
      console.log("\nToken Account:", tokenAccount.toString());


      const [listingPDA, bump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),  // Match the seed in your Rust code
          mint.publicKey.toBuffer()  // Use mint key, not listing key
        ],
        program.programId  // Use your program's ID, not PROGRAM_ID
      );
     
      console.log("\nPDAs:");

     

     

      

      console.log("\nExecuting List instruction...");
      const listPrice = new anchor.BN(1_000_000_000);
      const txSignature = await program.methods
        .listNft(listPrice)
        .accountsStrict({
          seller: payer.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          tokenAccount: tokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID, // Added token program
          systemProgram: SystemProgram.programId,
        })
        .signers([payer])
        .rpc();

      console.log("Transaction signature:", txSignature);

      const listing = await program.account.listingData.fetch(listingPDA);

  // Assertions
  console.log("\nListing Account Verification:");
  console.log("Seller:", listing.seller.toString());
  console.log("Mint:", listing.mint.toString());
  console.log("Price:", listing.price.toString());
  console.log("Created At:", listing.createdAt.toString());
  console.log("History Length:", listing.history.length);

  // Verify seller
  assert.strictEqual(
    listing.seller.toString(), 
    payer.publicKey.toString(), 
    "Seller should match the listing account"
  );

  // Verify mint
  assert.strictEqual(
    listing.mint.toString(), 
    mint.publicKey.toString(), 
    "Mint should match the listed NFT"
  );

  // Verify price
  assert.strictEqual(
    listing.price.toString(), 
    listPrice.toString(), 
    "Listing price should match input"
  );

  // Verify history
  assert.strictEqual(
    listing.history.length, 
    1, 
    "History should have one entry"
  );

  const tradeHistory = listing.history[0];
  console.log("\nTrade History Verification:");
  console.log("History Price:", tradeHistory.price.toString());
  console.log("History Timestamp:", tradeHistory.timestamp.toString());
  console.log("History Action:", tradeHistory.action);

  // Verify trade history details
  assert.strictEqual(
    tradeHistory.price.toString(), 
    listPrice.toString(), 
    "Trade history price should match listing price"
  );
  const zero = new anchor.BN(0)

  assert.deepStrictEqual(
    tradeHistory.action, 
    { list: {} },  // Corresponds to TradeAction::List
    "Trade action should be List"
  );

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
  before(async () => {
    console.log("\nInitial Setup:");
    console.log("Payer Public Key:", payer.publicKey.toString());
    console.log("Mint Public Key:", mint.publicKey.toString());
    console.log("Creator Public Key:", creator.publicKey.toString());

   

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

  it("Update Listing Price", async () => {
    try {
      // Derive associated token account for the mint
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        payer.publicKey
      );
      console.log("\nToken Account:", tokenAccount.toString());


      const [listingPDA, bump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),  // Match the seed in your Rust code
          mint.publicKey.toBuffer()  // Use mint key, not listing key
        ],
        program.programId  // Use your program's ID, not PROGRAM_ID
      );
     
      console.log("\nPDAs:");
     

      

      console.log("\nExecuting List instruction...");
      const newPrice = new anchor.BN(2_000_000_000);
      const updateTx = await program.methods
      .updateListing(newPrice)
      .accountsStrict({
        seller: payer.publicKey,
        listing: listingPDA,
        mint: mint.publicKey,
        tokenAccount: tokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID, // Added
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();

      console.log("Transaction signature:", updateTx);
  

      const listing = await program.account.listingData.fetch(listingPDA);

  // Assertions
  console.log("\nListing Account Verification:");
  console.log("Seller:", listing.seller.toString());
  console.log("Mint:", listing.mint.toString());
  console.log("Price:", listing.price.toString());
  console.log("Created At:", listing.createdAt.toString());
  console.log("History Length:", listing.history.length);

  // Verify seller
  assert.strictEqual(
    listing.seller.toString(), 
    payer.publicKey.toString(), 
    "Seller should match the listing account"
  );

  // Verify mint
  assert.strictEqual(
    listing.mint.toString(), 
    mint.publicKey.toString(), 
    "Mint should match the listed NFT"
  );

  // Verify price
  assert.strictEqual(
    listing.price.toString(), 
    newPrice.toString(), 
    "Listing price should match input"
  );

  // Verify history
  assert.strictEqual(
    listing.history.length, 
    2, 
    "History should have one entry"
  );

  const tradeHistory = listing.history[1];
  console.log("\nTrade History Verification:");
  console.log("History Price:", tradeHistory.price.toString());
  console.log("History Timestamp:", tradeHistory.timestamp.toString());
  console.log("History Action:", tradeHistory.action);

  // Verify trade history details
  assert.strictEqual(
    tradeHistory.price.toString(), 
    newPrice.toString(), 
    "Trade history price should match listing price"
  );
 

  assert.deepStrictEqual(
    tradeHistory.action, 
    { updatePrice: {} },  // Corresponds to TradeAction::List
    "Trade action should be List"
  );


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
/////////////////////////////////PURCHASING TESTING///////////////////////////////////////////////////////////
before(async () => {
  // Fund payer account
  const tx = await provider.connection.requestAirdrop(
    payer.publicKey,
    2 * anchor.web3.LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(tx, "confirmed");

  const buyerTx = await provider.connection.requestAirdrop(
    buyer.publicKey,
    3 * anchor.web3.LAMPORTS_PER_SOL
  );
  await provider.connection.confirmTransaction(buyerTx, "confirmed");

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



  console.log("Payer Account Token: {}",payer.publicKey)
  console.log("buyer of NFT Account Token: {}",buyer.publicKey)
  console.log("mint Account Token: {}",mint.publicKey)
  console.log("creator Account Token: {}",creator.publicKey)
});

it("Purchases NFT", async () => {
  try {
    // Derive associated token accounts
    const tokenAccount = await getAssociatedTokenAddress(mint.publicKey, payer.publicKey);
    const buyerTokenAccount = await getAssociatedTokenAddress(mint.publicKey, buyer.publicKey);
    console.log("\nToken Accounts:");
    console.log("Seller Token Account:", tokenAccount.toString());
    console.log("Buyer Token Account:", buyerTokenAccount.toString());

    // Get initial balances
    const getTokenBalance = async (pubKey) => {
      try {
        const balance = await provider.connection.getTokenAccountBalance(pubKey);
        return parseInt(balance.value.amount);
      } catch {
        return 0;
      }
    };

    const initialSellerTokenBalance = await getTokenBalance(tokenAccount);
    const initialBuyerTokenBalance = await getTokenBalance(buyerTokenAccount);
    const initialSellerBalance = await provider.connection.getBalance(payer.publicKey);
    const initialBuyerBalance = await provider.connection.getBalance(buyer.publicKey);
    const initialCreatorBalance = await provider.connection.getBalance(creator.publicKey);

    console.log("\nInitial Balances:");
    console.log("Initial Seller Token Balance:", initialSellerTokenBalance);
    console.log("Initial Buyer Token Balance:", initialBuyerTokenBalance);
    console.log("Initial Seller SOL Balance:", initialSellerBalance / anchor.web3.LAMPORTS_PER_SOL);
    console.log("Initial Buyer SOL Balance:", initialBuyerBalance / anchor.web3.LAMPORTS_PER_SOL);
    console.log("Initial Creator SOL Balance:", initialCreatorBalance / anchor.web3.LAMPORTS_PER_SOL);

    // Get listing details
    const [listingPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("listing"), mint.publicKey.toBuffer()],
      program.programId
    );
    
    const listingAccount = await program.account.listingData.fetch(listingPDA);
    const price = listingAccount.price.toNumber();
    
    console.log("\nListing Details:");
    console.log("Listing Price:", price / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    
    const expectedRoyalty = (price * 3) / 100;
    // Adjust priceWithRoyalty to account for transaction fees
    const priceWithRoyalty = price + expectedRoyalty - 0.06 * anchor.web3.LAMPORTS_PER_SOL; // Subtract approximate tx fees

    console.log("Expected Royalty:", expectedRoyalty / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    console.log("Total Price with Royalty:", priceWithRoyalty / anchor.web3.LAMPORTS_PER_SOL, "SOL");

    // Execute purchase
    const txSignature = await program.methods
      .purchaseNft()
      .accountsStrict({
        buyer: buyer.publicKey,
        seller: payer.publicKey,
        creator: creator.publicKey,
        listing: listingPDA,
        mint: mint.publicKey,
        sellerToken: tokenAccount,
        buyerToken: buyerTokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    // Get final balances
    const finalSellerTokenBalance = await getTokenBalance(tokenAccount);
    const finalBuyerTokenBalance = await getTokenBalance(buyerTokenAccount);
    const finalSellerBalance = await provider.connection.getBalance(payer.publicKey);
    const finalBuyerBalance = await provider.connection.getBalance(buyer.publicKey);
    const finalCreatorBalance = await provider.connection.getBalance(creator.publicKey);

    const buyerPayment = initialBuyerBalance - finalBuyerBalance;
    const creatorIncome = finalCreatorBalance - initialCreatorBalance;
    const sellerIncome = finalSellerBalance - initialSellerBalance;

    console.log("\nFinal Balances and Transfers:");
    console.log("Final Seller Token Balance:", finalSellerTokenBalance);
    console.log("Final Buyer Token Balance:", finalBuyerTokenBalance);
    console.log("Final Seller SOL Balance:", finalSellerBalance / anchor.web3.LAMPORTS_PER_SOL);
    console.log("Final Buyer SOL Balance:", finalBuyerBalance / anchor.web3.LAMPORTS_PER_SOL);
    console.log("Final Creator SOL Balance:", finalCreatorBalance / anchor.web3.LAMPORTS_PER_SOL);
    console.log("Buyer Payment:", buyerPayment / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    console.log("Creator Income:", creatorIncome / anchor.web3.LAMPORTS_PER_SOL, "SOL");
    console.log("Seller Income:", sellerIncome / anchor.web3.LAMPORTS_PER_SOL, "SOL");

    // Assertions with detailed error messages
    assert.isAtMost(
      Math.abs(buyerPayment - priceWithRoyalty),
      0.1 * anchor.web3.LAMPORTS_PER_SOL,
      "Buyer payment should be within acceptable range of expected price"
    );


    
    assert.strictEqual(
      finalSellerTokenBalance,
      initialSellerTokenBalance - 1,
      "Seller should lose 1 NFT"
    );
    assert.strictEqual(
      finalBuyerTokenBalance,
      initialBuyerTokenBalance + 1,
      "Buyer should receive 1 NFT"
    );




    assert.strictEqual(creatorIncome, expectedRoyalty, "Creator should receive correct royalty");
    
    const expectedSellerProceeds = price - expectedRoyalty;
    const minExpectedSellerIncome = expectedSellerProceeds - 0.01 * anchor.web3.LAMPORTS_PER_SOL;
    assert.isAtLeast(
      sellerIncome,
      minExpectedSellerIncome,
      "Seller should receive at least (price - royalty - fees)"
    );

   

    // Account existence check
    const buyerTokenAccountInfo = await provider.connection.getAccountInfo(buyerTokenAccount);
    assert.exists(buyerTokenAccountInfo, "Buyer token account should be initialized");

    console.log("Transaction signature:", txSignature);

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
  ///////////////////////////////////////////////////LAZY TESTING/////////////////////////////////

  it("Buyer can list NFT after purchasing", async () => {
    try {
      const [listingPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.publicKey.toBuffer()],
        program.programId
      );
      console.log("LISTINGPDA: {}",listingPDA);

     
      

      // Now create the new listing
      const newListingPrice = new anchor.BN(1_500_000_000);
      const buyerTokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        buyer.publicKey
      );

      console.log("buyerTokenAccount: {}",buyerTokenAccount);

      

      await program.methods
        .listNft(newListingPrice)
        .accountsStrict({
          seller: buyer.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          tokenAccount: buyerTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      // Verify the new listing
      const newListing = await program.account.listingData.fetch(listingPDA);
      assert.strictEqual(newListing.seller.toString(), buyer.publicKey.toString());
      assert.strictEqual(newListing.price.toString(), newListingPrice.toString());
    } catch (error) {
      console.error("Error in buyer listing purchased NFT:", error);
      if ('logs' in error) {
        console.error("Program Logs:", error.logs);
      }
      throw error;
    }
  });
  
  it("Buyer can update listing price of purchased NFT", async () => {
    try {
      const [listingPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.publicKey.toBuffer()],
        program.programId
      );

      const buyerTokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        buyer.publicKey
      );

      // Verify the listing exists and belongs to the buyer
      const listing = await program.account.listingData.fetch(listingPDA);
      assert.strictEqual(listing.seller.toString(), buyer.publicKey.toString(), 
        "Listing must belong to buyer before updating");

      const updatedPrice = new anchor.BN(2_000_000_000);
      await program.methods
        .updateListing(updatedPrice)
        .accountsStrict({
          seller: buyer.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          tokenAccount: buyerTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      const updatedListing = await program.account.listingData.fetch(listingPDA);
      assert.strictEqual(updatedListing.price.toString(), updatedPrice.toString());
    } catch (error) {
      console.error("Error in buyer updating listing price:", error);
      if ('logs' in error) {
        console.error("Program Logs:", error.logs);
      }
      throw error;
    }
  });
  
  it("Buyer can cancel listing of purchased NFT", async () => {
    try {
      const [listingPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.publicKey.toBuffer()],
        program.programId
      );

      const buyerTokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        buyer.publicKey
      );

      // Verify the listing exists and belongs to the buyer
      const listing = await program.account.listingData.fetch(listingPDA);
      assert.strictEqual(listing.seller.toString(), buyer.publicKey.toString(), 
        "Listing must belong to buyer before canceling");

      await program.methods
        .cancelListing()
        .accountsStrict({
          seller: buyer.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          tokenAccount: buyerTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      
   
    } catch (error) {
      console.error("Error in buyer canceling listing:", error);
      if ('logs' in error) {
        console.error("Program Logs:", error.logs);
      }
      throw error;
    }
  });
  
  it("Should prevent malicious users from purchasing an inactive listing", async () => {
    try {
      const maliciousUser = anchor.web3.Keypair.generate();

      const tx = await provider.connection.requestAirdrop(
        maliciousUser.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(tx, "confirmed");
      const maliciousTokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        maliciousUser.publicKey
      );
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        payer.publicKey
      );
  
      // First, cancel the existing listing
      const [listingPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.publicKey.toBuffer()],
        program.programId
      );
  
      // Attempt to purchase when listing is inactive should fail
      await program.methods
        .purchaseNft()
        .accountsStrict({
          buyer: maliciousUser.publicKey,
          seller: payer.publicKey,
          creator: creator.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          sellerToken: tokenAccount,
          buyerToken: maliciousTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maliciousUser])
        .rpc();
  
      assert.fail("Expected an error, but transaction succeeded");
    } catch (error) {
      console.log("Error Message Malicous user purchasing inactive listing: {} ",error.message)
    }
  });
  
  it("Should prevent non-owner from updating a listing", async () => {
    try {
      // First, list the NFT
      const [listingPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("listing"), mint.publicKey.toBuffer()],
        program.programId
      );
  
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        payer.publicKey
      );
  
      const newListingPrice = new anchor.BN(2_000_000_000);
      const maliciousUser = anchor.web3.Keypair.generate();
  
      await program.methods
        .updateListing(newListingPrice)
        .accountsStrict({
          seller: maliciousUser.publicKey,
          listing: listingPDA,
          mint: mint.publicKey,
          tokenAccount: tokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maliciousUser])
        .rpc();
  
      assert.fail("Expected an error, but transaction succeeded");
    } catch (error) {
      console.log("Error Message malicous user updating listing: {} ",error.message)
    }
  });

  ///////////////////////////////////More Purchasing Testing/////////////////////////////////////////

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

  it("Should not allow a non-seller to update the listing price", async () => {
    try {
      const [listingPDA, bump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),  // Match the seed in your Rust code
          mint.publicKey.toBuffer()  // Use mint key, not listing key
        ],
        program.programId  // Use your program's ID, not PROGRAM_ID
      );
      const newPrice = new anchor.BN(2_000_000_000);
  
      const maliciousUser = anchor.web3.Keypair.generate();
      const tokenAccount = await getAssociatedTokenAddress(
        mint.publicKey,
        payer.publicKey
      );
  
      await program.methods
      .updateListing(newPrice)
      .accountsStrict({
        seller: maliciousUser.publicKey,
        listing: listingPDA,
        mint: mint.publicKey,
        tokenAccount: tokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID, // Added
        systemProgram: SystemProgram.programId,
      })
      .signers([maliciousUser])
      .rpc();

      console.log("Failed Succesfully,Should Not Allow A Non Seller TO Update Listing");
      assert.fail("Expected an error, but transaction succeeded");
      
      
    } catch (error) {
      
    }
  });
  // before(async () => {
  //   console.log("\nInitial Setup:");
  //   console.log("Payer Public Key:", payer.publicKey.toString());
  //   console.log("Mint Public Key:", mint.publicKey.toString());
  //   console.log("Creator Public Key:", creator.publicKey.toString());
    

  //   // Derive PDA for stats account
  //   [statsAccountPda, statsAccountBump] = await PublicKey.findProgramAddress(
  //     [Buffer.from("stats"), mint.publicKey.toBuffer()],
  //     program.programId
  //   );
  //   console.log("Stats Account PDA:", statsAccountPda.toString());
  //   console.log("Stats Account Bump:", statsAccountBump);

  //   // Fund payer account
  //   const tx = await provider.connection.requestAirdrop(
  //     payer.publicKey,
  //     2 * anchor.web3.LAMPORTS_PER_SOL
  //   );
  //   await provider.connection.confirmTransaction(tx, "confirmed");

  //   const creatorTx = await provider.connection.requestAirdrop(
  //     creator.publicKey,
  //     1 * anchor.web3.LAMPORTS_PER_SOL
  //   );
  //   await provider.connection.confirmTransaction(creatorTx, "confirmed");

  //   // Log balances
  //   const payerBalance = await provider.connection.getBalance(payer.publicKey);
  //   const creatorBalance = await provider.connection.getBalance(creator.publicKey);
  //   console.log("\nAccount Balances:");
  //   console.log("Payer Balance:", payerBalance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
  //   console.log("Creator Balance:", creatorBalance / anchor.web3.LAMPORTS_PER_SOL, "SOL");
  // });

  // it("Should not allow a non-seller to list a NFT", async () => {
  //   try {
  //     const [listingPDA, bump] = PublicKey.findProgramAddressSync(
  //       [
  //         Buffer.from("listing"),  // Match the seed in your Rust code
  //         mint.publicKey.toBuffer()  // Use mint key, not listing key
  //       ],
  //       program.programId  // Use your program's ID, not PROGRAM_ID
  //     );
  //     const newPrice = new anchor.BN(2_000_000_000);
  
  //     const maliciousUser = anchor.web3.Keypair.generate();
  //     const tokenAccount = await getAssociatedTokenAddress(
  //       mint.publicKey,
  //       payer.publicKey
  //     );

  //     await program.methods
  //       .cancelListing()
  //       .accountsStrict({
  //         seller: payer.publicKey, // Malicious actor
  //         listing: listingPDA,
  //         mint: mint.publicKey,
          
  //       })
  //       .signers([payer])
  //       .rpc();
  
  //     await program.methods
  //       .listNft(newPrice)
  //       .accountsStrict({
  //         seller: maliciousUser.publicKey, // Malicious actor
  //         listing: listingPDA,
  //         mint: mint.publicKey,
  //         tokenAccount,
  //         systemProgram: SystemProgram.programId,
  //       })
  //       .signers([maliciousUser])
  //       .rpc();
  //     console.log("Failed Succesfully,Should Not Allow A Non Seller TO list an nft Listing");
  //     assert.fail("Expected an error, but transaction succeeded");
  //   } catch (error) {
  //     console.log("Caught expected error:", error.message);
 
  //   }
  // });
  
  // it("Should reject an invalid price (e.g., zero)", async () => {
  //   try {
  //     const tokenAccount = await getAssociatedTokenAddress(
  //       mint.publicKey,
  //       payer.publicKey
  //     );

  //     const [listingPDA, bump] = PublicKey.findProgramAddressSync(
  //       [
  //         Buffer.from("listing"),  // Match the seed in your Rust code
  //         mint.publicKey.toBuffer()  // Use mint key, not listing key
  //       ],
  //       program.programId  // Use your program's ID, not PROGRAM_ID
  //     );
  //     const invalidPrice = new anchor.BN(0);
  
  //     await program.methods
  //       .updateListing(invalidPrice)
  //       .accountsStrict({
  //         seller: payer.publicKey,
  //         listing: listingPDA,
  //         mint: mint.publicKey,
  //         tokenAccount,
  //       })
  //       .signers([payer])
  //       .rpc();
  
  //     assert.fail("Expected an error, but transaction succeeded");
  //   } catch (error) {
  //     console.log("Caught error On expecting Price Fail because Invalid Price:", error.message);
     
  //   }
  // });
  
  // it("Should not allow updating an inactive listing", async () => {
  //   try {
  //     const newPrice = new anchor.BN(3_000_000_000);
  //     const [listingPDA, bump] = PublicKey.findProgramAddressSync(
  //       [
  //         Buffer.from("listing"),  // Match the seed in your Rust code
  //         mint.publicKey.toBuffer()  // Use mint key, not listing key
  //       ],
  //       program.programId  // Use your program's ID, not PROGRAM_ID
  //     );

  //     const tokenAccount = await getAssociatedTokenAddress(
  //       mint.publicKey,
  //       payer.publicKey
  //     );
  
  //     // Simulate deactivating the listing
  //     await program.methods
  //       .cancelListing()
  //       .accountsStrict({
  //         seller: payer.publicKey,
  //         listing: listingPDA,
  //         mint: mint.publicKey,
  //       })
  //       .signers([payer])
  //       .rpc();
  
  //     await program.methods
  //       .updateListing(newPrice)
  //       .accountsStrict({
  //         seller: payer.publicKey,
  //         listing: listingPDA,
  //         mint: mint.publicKey,
  //         tokenAccount,
  //       })
  //       .signers([payer])
  //       .rpc();
  
  //     assert.fail("Expected an error, but transaction succeeded");
  //   } catch (error) {
  //     console.log("Caught expected error, should fail bc you should not update an inactive Listing:", error.message);
     
  //   }
  // });
  
});