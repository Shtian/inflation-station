import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import prismaClient from "@prisma/client";

const { PrismaClient } = prismaClient;

const adapter = new PrismaBetterSqlite3({ url: "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

// --- Helpers ---

function getPreviousMonths(count) {
  const months = [];
  const now = new Date();
  for (let i = count; i >= 1; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d);
  }
  return months;
}

function monthDate(monthStart, day) {
  return new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
}

function lastDayOfMonth(monthStart) {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
}

// --- Cleanup ---

async function clearAll() {
  await prisma.categorizationSuggestion.deleteMany();
  await prisma.importReviewRow.deleteMany();
  await prisma.importReviewSession.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.categoryRule.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.monthlyReview.deleteMany();
  await prisma.importProviderFieldMapping.deleteMany();
  await prisma.importProviderMapping.deleteMany();
}

// --- Main ---

async function main() {
  console.log("Clearing existing data...");
  await clearAll();

  // --- Accounts ---
  console.log("Creating accounts...");
  const [checking, savings, creditCard, brukskonto] = await Promise.all([
    prisma.account.create({ data: { name: "Lønnskonto", institution: "DNB" } }),
    prisma.account.create({ data: { name: "Sparekonto", institution: "DNB" } }),
    prisma.account.create({
      data: { name: "Visa Kredittkort", institution: "DNB" },
    }),
    prisma.account.create({ data: { name: "Brukskonto", institution: "DNB" } }),
  ]);

  // --- Categories (global — no accountId so all accounts can use them) ---
  console.log("Creating categories...");
  const categoryDefs = [
    { name: "Lønn", kind: "INCOME" },
    { name: "Renteinntekt", kind: "INCOME" },
    { name: "Dagligvarer", kind: "EXPENSE" },
    { name: "Restaurant & Takeaway", kind: "EXPENSE" },
    { name: "Transport", kind: "EXPENSE" },
    { name: "Strøm & Internett", kind: "EXPENSE" },
    { name: "Abonnementer", kind: "EXPENSE" },
    { name: "Helse", kind: "EXPENSE" },
    { name: "Shopping", kind: "EXPENSE" },
    { name: "Forsikring", kind: "EXPENSE" },
    { name: "Boliglån", kind: "EXPENSE" },
    { name: "Billån", kind: "EXPENSE" },
    { name: "Bil", kind: "EXPENSE" },
    { name: "Underholdning", kind: "EXPENSE" },
    { name: "Spareoverføring", kind: "TRANSFER" },
    { name: "Kredittkortbetaling", kind: "TRANSFER" },
    { name: "Kontantuttak", kind: "TRANSFER" },
  ];

  const categories = {};
  for (const def of categoryDefs) {
    const cat = await prisma.category.create({
      data: { name: def.name, kind: def.kind },
    });
    categories[def.name] = cat;
  }

  // --- Category Rules (on Lønnskonto) ---
  console.log("Creating category rules...");
  const ruleDefs = [
    { merchantContains: "rema", paymentType: "CARD", category: "Dagligvarer" },
    { merchantContains: "kiwi", paymentType: "CARD", category: "Dagligvarer" },
    { merchantContains: "meny", paymentType: "CARD", category: "Dagligvarer" },
    { merchantContains: "coop", paymentType: "CARD", category: "Dagligvarer" },
    {
      merchantContains: "mcdonalds",
      paymentType: "CARD",
      category: "Restaurant & Takeaway",
    },
    {
      merchantContains: "burger king",
      paymentType: "CARD",
      category: "Restaurant & Takeaway",
    },
    {
      merchantContains: "pizza",
      paymentType: "CARD",
      category: "Restaurant & Takeaway",
    },
    {
      merchantContains: "sushi",
      paymentType: "CARD",
      category: "Restaurant & Takeaway",
    },
    { merchantContains: "ruter", paymentType: "CARD", category: "Transport" },
    { merchantContains: "vy", paymentType: "EFT", category: "Transport" },
    {
      merchantContains: "netflix",
      paymentType: "CARD",
      category: "Abonnementer",
    },
    {
      merchantContains: "spotify",
      paymentType: "CARD",
      category: "Abonnementer",
    },
    {
      merchantContains: "viaplay",
      paymentType: "CARD",
      category: "Abonnementer",
    },
    { merchantContains: "apotek", paymentType: "CARD", category: "Helse" },
    { merchantContains: "vitusapotek", paymentType: "CARD", category: "Helse" },
    { merchantContains: "h&m", paymentType: "CARD", category: "Shopping" },
    { merchantContains: "zalando", paymentType: "CARD", category: "Shopping" },
    { merchantContains: "elkjøp", paymentType: "CARD", category: "Shopping" },
    { merchantContains: "cubus", paymentType: "CARD", category: "Shopping" },
    {
      merchantContains: "kino",
      paymentType: "CARD",
      category: "Underholdning",
    },
    { merchantContains: "husbanken", paymentType: "EFT", category: "Boliglån" },
    { merchantContains: "santander", paymentType: "EFT", category: "Billån" },
    { merchantContains: "recharge", paymentType: "CARD", category: "Bil" },
    { merchantContains: "fortum", paymentType: "CARD", category: "Bil" },
    { merchantContains: "bilvask", paymentType: "CARD", category: "Bil" },
  ];

  for (const [i, rule] of ruleDefs.entries()) {
    await prisma.categoryRule.create({
      data: {
        accountId: checking.id,
        categoryId: categories[rule.category].id,
        merchantContains: rule.merchantContains,
        paymentType: rule.paymentType,
        priority: (i + 1) * 10,
      },
    });
  }

  // --- Import Provider Mappings (Norwegian banks) ---
  console.log("Creating import provider mappings...");

  // DNB Bank — semicolon-separated CSV with debit/credit in separate columns
  const dnb = await prisma.importProviderMapping.create({
    data: {
      providerName: "DNB Bank",
      normalizationRules: {
        dateFormat: "DD.MM.YYYY",
        decimalSeparator: ",",
        encoding: "UTF-8",
        delimiter: ";",
      },
      mappingVersion: 1,
    },
  });
  for (const [sourceField, canonicalField] of [
    ["Dato", "bookingDate"],
    ["Forklaring", "normalizedMerchant"],
    ["Forklaring", "title"],
    ["Ut fra konto", "amountNok"],
    ["Inn på konto", "amountNok"],
  ]) {
    await prisma.importProviderFieldMapping
      .create({
        data: { providerMappingId: dnb.id, sourceField, canonicalField },
      })
      .catch(() => {}); // skip duplicate canonicalField entries
  }

  // Nordea — semicolon-separated with full sender/recipient fields
  const nordea = await prisma.importProviderMapping.create({
    data: {
      providerName: "Nordea",
      normalizationRules: {
        dateFormat: "DD.MM.YYYY",
        decimalSeparator: ",",
        encoding: "UTF-8",
        delimiter: ";",
      },
      mappingVersion: 1,
    },
  });
  for (const [sourceField, canonicalField] of [
    ["Bokføringsdato", "bookingDate"],
    ["Beløp", "amountNok"],
    ["Avsender", "sender"],
    ["Mottaker", "recipient"],
    ["Navn", "name"],
    ["Tittel", "normalizedMerchant"],
    ["Tittel", "title"],
  ]) {
    await prisma.importProviderFieldMapping
      .create({
        data: { providerMappingId: nordea.id, sourceField, canonicalField },
      })
      .catch(() => {});
  }

  // SpareBank 1 — semicolon-separated with description field
  const sb1 = await prisma.importProviderMapping.create({
    data: {
      providerName: "SpareBank 1",
      normalizationRules: {
        dateFormat: "DD.MM.YYYY",
        decimalSeparator: ",",
        encoding: "UTF-8",
        delimiter: ";",
      },
      mappingVersion: 1,
    },
  });
  for (const [sourceField, canonicalField] of [
    ["Dato", "bookingDate"],
    ["Beskrivelse", "normalizedMerchant"],
    ["Beskrivelse", "title"],
    ["Beløp", "amountNok"],
    ["Avsender", "sender"],
    ["Mottaker", "recipient"],
  ]) {
    await prisma.importProviderFieldMapping
      .create({
        data: { providerMappingId: sb1.id, sourceField, canonicalField },
      })
      .catch(() => {});
  }

  // --- Transactions by month ---
  const months = getPreviousMonths(3);
  console.log(
    `Creating transactions for months: ${months.map((m) => m.toISOString().slice(0, 7)).join(", ")}...`,
  );

  // Raw bank statement text for the merchant display field
  const merchantRawMap = {
    "Norsk Arbeidsgiver AS": "NORSK ARBEIDSGIVER AS",
    "Husbanken boliglån": "HUSBANKEN BOLIGLAN",
    "Santander billån": "SANTANDER CONSUMER BANK AS",
    "Sparekonto overføring": "NETTBETALING TIL SPAREKONTO",
    Spotify: "SPOTIFY AB",
    Netflix: "NETFLIX.COM",
    Viaplay: "VIAPLAY GROUP NORWAY AS",
    "Rema 1000": "REMA 1000 OSLO GRØNLAND 4",
    "Gjensidige Forsikring": "GJENSIDIGE FORSIKRING ASA",
    "Recharge elbil-lading": "RECHARGE AS *MAJORSTUEN",
    "Bilvask Shellstasjon": "SHELL BILVASK LYSAKER",
    Kiwi: "KIWI 0445 STOVNER",
    "Burger King": "BURGER KING OSLO CITY",
    "Ruter månedskort": "RUTER AS MÅNEDSKORT",
    "Minibank uttak": "DNB MINIBANK OSLO S",
    "Apotek 1": "APOTEK 1 GLASMAGASINET",
    Meny: "MENY BOGSTADVEIEN",
    McDonalds: "MCDONALDS STORO",
    "Telenor internett": "TELENOR NORGE AS",
    "H&M": "H&M HENNES & MAURITZ OSLO CITY",
    "Fortum lading": "FORTUM CHARGE & DRIVE *HELSFYR",
    "Sushi restaurant": "SUSHI & WOK GRÜNERLØKKA",
    "Coop Extra": "COOP EXTRA HELSFYR",
    "Kredittkortbetaling DNB": "NETTBETALING VISA KREDITTKORT",
    "Pizza Hut": "PIZZA HUT STORO",
    "Overføring fra lønnskonto": "NETTBETALING FRA LØNNSKONTO",
    "Renteinntekt DNB": "RENTER DNB SPAREKONTO",
    Zalando: "ZALANDO SE",
    "Restaurant Mathallen": "MATHALLEN FOOD HALL AS",
    Elkjøp: "ELKJØP NORGE AS STORO",
    Kino: "NORDISK FILM KINO AS",
    Vitusapotek: "VITUSAPOTEK BOGSTADVEIEN",
    Cubus: "CUBUS AS OSLO CITY",
    "Narvesen kiosk": "NARVESEN OSLO S",
    "Bondens marked": "BONDENS MARKED YOUNGSTORGET",
    Parkering: "APCOA PARKING OSLO",
    "Ukjent betaling": "BETALING 12345678",
    "Diverse innkjøp": "DIVERSE INNKJØP NETT",
    "Netthandel ukjent": "UKJENT NETTHANDEL",
    Vinmonopolet: "VINMONOPOLET MAJORSTUEN",
    "Clas Ohlson": "CLAS OHLSON AS BYPORTEN",
    "IKEA julepynt": "IKEA AS FURUSET",
    "Julefrokost jobben": "ENGEBRET CAFÉ AS",
    "Vy tog julebesøk": "VY GRUPPEN AS",
    "Meny julehandel": "MENY BOGSTADVEIEN",
    "Pandora smykker": "PANDORA JEWELRY OSLO CITY",
    "Boozt klær": "BOOZT.COM AB",
    "Leketøy julehandel": "SPACEWORLD LEKER BYPORTEN",
    "Vinmonopolet nyttår": "VINMONOPOLET MAJORSTUEN",
    "SATS treningssenter": "SATS NORWAY AS",
    "Komplett.no januarsalg": "KOMPLETT.NO AS",
    "XXL Sport nyttårssalg": "XXL SPORT & VILLMARK STORO",
  };

  // Pattern → category for auto-matching and suggestion creation
  const merchantCategoryMap = [
    { pattern: "rema", category: "Dagligvarer" },
    { pattern: "kiwi", category: "Dagligvarer" },
    { pattern: "meny", category: "Dagligvarer" },
    { pattern: "coop", category: "Dagligvarer" },
    { pattern: "mcdonalds", category: "Restaurant & Takeaway" },
    { pattern: "burger king", category: "Restaurant & Takeaway" },
    { pattern: "pizza", category: "Restaurant & Takeaway" },
    { pattern: "sushi", category: "Restaurant & Takeaway" },
    { pattern: "ruter", category: "Transport" },
    { pattern: "netflix", category: "Abonnementer" },
    { pattern: "spotify", category: "Abonnementer" },
    { pattern: "viaplay", category: "Abonnementer" },
    { pattern: "vitusapotek", category: "Helse" },
    { pattern: "apotek", category: "Helse" },
    { pattern: "h&m", category: "Shopping" },
    { pattern: "zalando", category: "Shopping" },
    { pattern: "elkjøp", category: "Shopping" },
    { pattern: "cubus", category: "Shopping" },
    { pattern: "kino", category: "Underholdning" },
    { pattern: "husbanken", category: "Boliglån" },
    { pattern: "santander", category: "Billån" },
    { pattern: "recharge", category: "Bil" },
    { pattern: "fortum", category: "Bil" },
    { pattern: "bilvask", category: "Bil" },
  ];

  function findCategory(merchant) {
    const lower = merchant.toLowerCase();
    for (const { pattern, category } of merchantCategoryMap) {
      if (lower.includes(pattern)) return categories[category];
    }
    return null;
  }

  function getMonthlyReviewText(monthStart) {
    const m = monthStart.toLocaleString("nb-NO", {
      month: "long",
      year: "numeric",
    });
    const month = monthStart.getMonth();
    if (month === 11) {
      return `${m} var preget av julehandel og høyere forbruk enn vanlig. Gaver, julepynt, ekstra dagligvarer og restaurantbesøk dyttet utgiftene godt over normalen. Faste lånekostnader på 24 500 kr gikk som planlagt, men kredittkortfakturaen endte betydelig høyere enn en vanlig måned. Tog til julebesøk la seg også til budsjettet.`;
    }
    if (month === 0) {
      return `${m} var en rolig måned etter julens høye forbruk. Restaurant og shopping dro ned, men et nytt SATS-abonnement og noen januarsalg bidro litt ekstra. Faste lånekostnader på 24 500 kr gikk som normalt, og sparingsoverføringen på 5 000 kr ble gjennomført som planlagt.`;
    }
    return `${m} var en typisk måned. Faste kostnader dominerte som vanlig — boliglånet på 20 000 kr og billånet på 4 500 kr utgjorde over halvparten av lønnen. Dagligvarer fra Rema 1000, Kiwi og Meny endte på ca. 2 800 kr, og elbil-lading kom til 670 kr. En overføring på 5 000 kr til sparekontoen holder sparemålet på rett kurs.`;
  }

  for (let mi = 0; mi < months.length; mi++) {
    const monthStart = months[mi];
    const y = monthStart.getFullYear();
    const mo = monthStart.getMonth() + 1; // 1-indexed

    // Creates a transaction and a RULE suggestion if merchant matches a known pattern
    async function addTx(
      account,
      merchant,
      amountNok,
      paymentType,
      day,
      categoryOverride,
    ) {
      const bookingDate = monthDate(monthStart, day);
      const category =
        categoryOverride !== undefined
          ? categoryOverride
          : findCategory(merchant);
      const tx = await prisma.transaction.create({
        data: {
          accountId: account.id,
          categoryId: category ? category.id : null,
          bookingDate,
          amountNok: amountNok.toString(),
          currency: "NOK",
          merchant: merchantRawMap[merchant] ?? null,
          normalizedMerchant: merchant,
          paymentType,
        },
      });

      if (category) {
        const matchedRule = merchantCategoryMap.find(({ pattern }) =>
          merchant.toLowerCase().includes(pattern),
        );
        if (matchedRule) {
          await prisma.categorizationSuggestion.create({
            data: {
              transactionId: tx.id,
              suggestedCategoryId: category.id,
              source: "RULE",
              confidence: 0.95,
              reasoning: `Matched rule: merchant contains '${matchedRule.pattern}'`,
            },
          });
        }
      }

      return tx;
    }

    // --- Lønnskonto ---
    // Salary arrives on the 25th of the prior month
    await prisma.transaction.create({
      data: {
        accountId: checking.id,
        categoryId: categories.Lønn.id,
        bookingDate: new Date(y, mo - 1, 25),
        amountNok: "45000",
        currency: "NOK",
        merchant: merchantRawMap["Norsk Arbeidsgiver AS"] ?? null,
        normalizedMerchant: "Norsk Arbeidsgiver AS",
        paymentType: "EFT",
      },
    });

    await addTx(
      checking,
      "Husbanken boliglån",
      -20000,
      "EFT",
      1,
      categories.Boliglån,
    );
    await addTx(
      checking,
      "Santander billån",
      -4500,
      "EFT",
      2,
      categories.Billån,
    );
    await addTx(
      checking,
      "Sparekonto overføring",
      -5000,
      "TRANSFER",
      2,
      categories.Spareoverføring,
    );
    await addTx(checking, "Spotify", -99, "CARD", 1);
    await addTx(checking, "Netflix", -179, "CARD", 1);
    await addTx(checking, "Viaplay", -99, "CARD", 1);
    await addTx(checking, "Rema 1000", -850, "CARD", 3);
    await addTx(
      checking,
      "Gjensidige Forsikring",
      -450,
      "EFT",
      5,
      categories.Forsikring,
    );
    await addTx(checking, "Recharge elbil-lading", -380, "CARD", 6);
    await addTx(checking, "Bilvask Shellstasjon", -199, "CARD", 6);
    await addTx(checking, "Kiwi", -380, "CARD", 7);
    await addTx(checking, "Burger King", -185, "CARD", 8);
    await addTx(checking, "Ruter månedskort", -420, "CARD", 10);
    await addTx(
      checking,
      "Minibank uttak",
      -1000,
      "CASH",
      12,
      categories.Kontantuttak,
    );
    await addTx(checking, "Apotek 1", -245, "CARD", 14);
    await addTx(checking, "Meny", -1150, "CARD", 15);
    await addTx(checking, "McDonalds", -138, "CARD", 16);
    await addTx(
      checking,
      "Telenor internett",
      -499,
      "EFT",
      18,
      categories["Strøm & Internett"],
    );
    await addTx(checking, "H&M", -799, "CARD", 20);
    await addTx(checking, "Fortum lading", -290, "CARD", 21);
    await addTx(checking, "Sushi restaurant", -420, "CARD", 22);
    await addTx(checking, "Coop Extra", -640, "CARD", 24);
    await addTx(
      checking,
      "Kredittkortbetaling DNB",
      -9500,
      "TRANSFER",
      25,
      categories.Kredittkortbetaling,
    );
    await addTx(checking, "Pizza Hut", -285, "CARD", 28);

    // --- Sparekonto ---
    await addTx(
      savings,
      "Overføring fra lønnskonto",
      5000,
      "TRANSFER",
      2,
      categories.Spareoverføring,
    );
    await addTx(
      savings,
      "Renteinntekt DNB",
      180,
      "EFT",
      15,
      categories.Renteinntekt,
    );

    // --- Visa Kredittkort ---
    await addTx(creditCard, "Zalando", -1299, "CARD", 4, categories.Shopping);
    await addTx(
      creditCard,
      "Restaurant Mathallen",
      -680,
      "CARD",
      9,
      categories["Restaurant & Takeaway"],
    );
    await addTx(creditCard, "Elkjøp", -2499, "CARD", 13, categories.Shopping);
    await addTx(creditCard, "Kino", -199, "CARD", 19, categories.Underholdning);
    await addTx(creditCard, "Vitusapotek", -380, "CARD", 23, categories.Helse);
    await addTx(creditCard, "Cubus", -899, "CARD", 27, categories.Shopping);

    // --- Brukskonto ---
    await addTx(
      brukskonto,
      "Narvesen kiosk",
      -45,
      "CASH",
      12,
      categories["Restaurant & Takeaway"],
    );
    await addTx(
      brukskonto,
      "Bondens marked",
      -220,
      "CASH",
      19,
      categories.Dagligvarer,
    );
    await addTx(brukskonto, "Parkering", -80, "CASH", 26, categories.Bil);

    // --- Month-specific extras ---
    const monthNum = monthStart.getMonth();

    // --- Uncategorized ---
    await addTx(checking, "Ukjent betaling", -350, "CARD", 9, null);
    if (monthNum === 11) {
      await addTx(checking, "Diverse innkjøp", -180, "CARD", 16, null);
    } else if (monthNum === 0) {
      await addTx(creditCard, "Netthandel ukjent", -640, "CARD", 11, null);
    }

    if (monthNum === 11) {
      // December: Christmas shopping, food, travel, higher CC bill
      await addTx(
        checking,
        "Vinmonopolet",
        -869,
        "CARD",
        10,
        categories.Shopping,
      );
      await addTx(
        checking,
        "Clas Ohlson",
        -1280,
        "CARD",
        12,
        categories.Shopping,
      );
      await addTx(
        checking,
        "IKEA julepynt",
        -649,
        "CARD",
        13,
        categories.Shopping,
      );
      await addTx(
        checking,
        "Julefrokost jobben",
        -890,
        "CARD",
        19,
        categories["Restaurant & Takeaway"],
      );
      await addTx(
        checking,
        "Vy tog julebesøk",
        -680,
        "EFT",
        23,
        categories.Transport,
      );
      await addTx(
        checking,
        "Meny julehandel",
        -2200,
        "CARD",
        23,
        categories.Dagligvarer,
      );
      await addTx(
        checking,
        "Kredittkortbetaling DNB",
        -15500,
        "TRANSFER",
        27,
        categories.Kredittkortbetaling,
      );
      await addTx(
        creditCard,
        "Pandora smykker",
        -1899,
        "CARD",
        6,
        categories.Shopping,
      );
      await addTx(
        creditCard,
        "Boozt klær",
        -2199,
        "CARD",
        14,
        categories.Shopping,
      );
      await addTx(
        creditCard,
        "Leketøy julehandel",
        -1349,
        "CARD",
        17,
        categories.Shopping,
      );
    }

    if (monthNum === 0) {
      // January: New Year's, resolutions, January sales
      await addTx(
        checking,
        "Vinmonopolet nyttår",
        -389,
        "CARD",
        1,
        categories.Shopping,
      );
      await addTx(
        checking,
        "SATS treningssenter",
        -399,
        "CARD",
        3,
        categories.Helse,
      );
      await addTx(
        checking,
        "Komplett.no januarsalg",
        -1799,
        "CARD",
        6,
        categories.Shopping,
      );
      await addTx(
        creditCard,
        "XXL Sport nyttårssalg",
        -1499,
        "CARD",
        5,
        categories.Shopping,
      );
    }

    // --- Monthly Review ---
    await prisma.monthlyReview.create({
      data: {
        monthStart,
        status: "GENERATED",
        reviewText: getMonthlyReviewText(monthStart),
        generatedAt: lastDayOfMonth(monthStart),
      },
    });
  }

  console.log("Seed complete.");
  console.log(
    `  Accounts: 4 (Lønnskonto, Sparekonto, Visa Kredittkort, Brukskonto)`,
  );
  console.log(`  Categories: ${categoryDefs.length}`);
  console.log(`  Category rules: ${ruleDefs.length} (on Lønnskonto)`);
  console.log(`  Import provider mappings: 3 (DNB Bank, Nordea, SpareBank 1)`);
  console.log(
    `  Months seeded: ${months.length} (${months.map((m) => m.toISOString().slice(0, 7)).join(", ")})`,
  );
  console.log(`  Monthly reviews: ${months.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
