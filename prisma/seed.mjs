import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import prismaClient from "@prisma/client";
import { resolveDatabaseUrl } from "../src/lib/database-url.ts";

const { PrismaClient } = prismaClient;

const adapter = new PrismaBetterSqlite3({ url: resolveDatabaseUrl() });
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
  return new Date(
    Date.UTC(monthStart.getFullYear(), monthStart.getMonth(), day),
  );
}

function lastDayOfMonth(monthStart) {
  return new Date(
    Date.UTC(monthStart.getFullYear(), monthStart.getMonth() + 1, 0),
  );
}

// Seeded PRNG (mulberry32) so a given month always reseeds to the same data.
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function formatKroner(amount) {
  return `${(Math.round(amount / 100) * 100).toLocaleString("nb-NO")} kr`;
}

// --- Cleanup ---

async function clearAll() {
  await prisma.categorizationSuggestion.deleteMany();
  await prisma.importReviewRow.deleteMany();
  await prisma.importReviewSession.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.categoryRule.deleteMany();
  await prisma.category.deleteMany();
  await prisma.account.deleteMany();
  await prisma.monthlyReview.deleteMany();
}

// --- Main ---

async function main() {
  console.log("Clearing existing data...");
  await clearAll();

  // --- Accounts ---
  console.log("Creating accounts...");
  const [checking, savings, creditCard, brukskonto] = await Promise.all([
    prisma.account.create({
      data: { name: "Lønnskonto", institution: "Nordea" },
    }),
    prisma.account.create({
      data: { name: "Sparekonto", institution: "Nordea" },
    }),
    prisma.account.create({
      data: { name: "Visa Kredittkort", institution: "Nordea" },
    }),
    prisma.account.create({
      data: { name: "Brukskonto", institution: "Nordea" },
    }),
  ]);

  // --- Categories (global — no accountId so all accounts can use them) ---
  console.log("Creating categories...");
  // Some categories are left without a hint so the empty hint state shows too.
  const categoryDefs = [
    { name: "Lønn", kind: "INCOME" },
    { name: "Renteinntekt", kind: "INCOME" },
    {
      name: "Dagligvarer",
      kind: "EXPENSE",
      hint: "Matbutikker og dagligvarer. Rema 1000, Kiwi, Meny, Coop Extra, Bondens marked",
    },
    {
      name: "Restaurant & Takeaway",
      kind: "EXPENSE",
      hint: "Spisesteder og hurtigmat. Burger King, McDonalds, Pizza Hut, Sushi restaurant, Narvesen kiosk",
    },
    {
      name: "Transport",
      kind: "EXPENSE",
      hint: "Kollektivtransport og tog. Ruter månedskort, Vy",
    },
    {
      name: "Strøm & Internett",
      kind: "EXPENSE",
      hint: "Strøm og bredbånd hjemme. Fjordkraft strøm, Telenor internett",
    },
    {
      name: "Abonnementer",
      kind: "EXPENSE",
      hint: "Strømmetjenester og digitale abonnementer. Spotify, Netflix, Viaplay",
    },
    {
      name: "Helse",
      kind: "EXPENSE",
      hint: "Apotek og trening. Apotek 1, Vitusapotek, SATS treningssenter",
    },
    { name: "Shopping", kind: "EXPENSE" },
    { name: "Forsikring", kind: "EXPENSE" },
    { name: "Boliglån", kind: "EXPENSE" },
    { name: "Billån", kind: "EXPENSE" },
    {
      name: "Bil",
      kind: "EXPENSE",
      hint: "Lading og vask av elbilen men ikke billånet. Recharge elbil-lading, Fortum lading, Bilvask Shellstasjon, Parkering",
    },
    { name: "Underholdning", kind: "EXPENSE" },
    { name: "Spareoverføring", kind: "TRANSFER" },
    {
      name: "Kredittkortbetaling",
      kind: "TRANSFER",
      hint: "Betaling av Visa-fakturaen fra lønnskonto og ikke selve kjøpene.",
    },
    { name: "Kontantuttak", kind: "TRANSFER" },
  ];

  const categories = {};
  for (const def of categoryDefs) {
    const cat = await prisma.category.create({
      data: {
        name: def.name,
        kind: def.kind,
        classifierHint: def.hint ?? null,
      },
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
    "Minibank uttak": "UTTAK MINIBANK OSLO S",
    "Apotek 1": "APOTEK 1 GLASMAGASINET",
    Meny: "MENY BOGSTADVEIEN",
    McDonalds: "MCDONALDS STORO",
    "Telenor internett": "TELENOR NORGE AS",
    "Fjordkraft strøm": "FJORDKRAFT AS",
    "H&M": "H&M HENNES & MAURITZ OSLO CITY",
    "Fortum lading": "FORTUM CHARGE & DRIVE *HELSFYR",
    "Sushi restaurant": "SUSHI & WOK GRÜNERLØKKA",
    "Coop Extra": "COOP EXTRA HELSFYR",
    "Kredittkortbetaling Nordea": "NETTBETALING VISA KREDITTKORT",
    "Pizza Hut": "PIZZA HUT STORO",
    "Overføring fra lønnskonto": "NETTBETALING FRA LØNNSKONTO",
    "Renteinntekt Nordea": "RENTER NORDEA SPAREKONTO",
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

  function getMonthlyRecap(monthStart, totals) {
    const m = monthStart.toLocaleString("nb-NO", {
      month: "long",
      year: "numeric",
    });
    const month = monthStart.getMonth();
    if (month === 11) {
      return {
        headline: `${m} var preget av julehandel og høyere forbruk enn vanlig.`,
        points: [
          "Gaver, julepynt, ekstra dagligvarer og restaurantbesøk dyttet utgiftene godt over normalen.",
          `Faste lånekostnader på 24 500 kr gikk som planlagt, men kredittkortfakturaen endte på ${formatKroner(totals.creditCard)}.`,
          "Tog til julebesøk la seg også til budsjettet.",
        ],
      };
    }
    if (month === 0) {
      return {
        headline: `${m} var en rolig måned etter julens høye forbruk.`,
        points: [
          "Restaurant og shopping dro ned, men et nytt SATS-abonnement og noen januarsalg bidro litt ekstra.",
          "Faste lånekostnader på 24 500 kr gikk som normalt, og sparingsoverføringen på 5 000 kr ble gjennomført som planlagt.",
        ],
      };
    }
    return {
      headline: `${m} var en typisk måned.`,
      points: [
        "Faste kostnader dominerte som vanlig — boliglånet på 20 000 kr og billånet på 4 500 kr utgjorde over halvparten av lønnen.",
        `Dagligvarer endte på ca. ${formatKroner(totals.groceries)}, og elbil-lading kom til ${formatKroner(totals.charging)}.`,
        "En overføring på 5 000 kr til sparekontoen holder sparemålet på rett kurs.",
      ],
    };
  }

  for (let mi = 0; mi < months.length; mi++) {
    const monthStart = months[mi];
    const y = monthStart.getFullYear();
    const mo = monthStart.getMonth() + 1; // 1-indexed
    const monthNum = monthStart.getMonth();

    // Bills and subscriptions repeat; everyday spending varies month to month.
    const random = createRandom(y * 100 + mo);
    const chance = (probability) => random() < probability;
    const between = (min, max) => min + Math.floor(random() * (max - min + 1));
    const kroner = (min, max) =>
      Math.round((min + random() * (max - min)) * 100) / 100;
    const pick = (items) => items[Math.floor(random() * items.length)];
    const pickSome = (items, count) =>
      [...items].sort(() => random() - 0.5).slice(0, count);
    const anyDay = () => between(1, 28);

    const totals = { groceries: 0, charging: 0, creditCard: 0 };

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
      if (account === creditCard) {
        totals.creditCard -= amountNok;
      }
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

    // --- Lønnskonto: fixed income, bills and subscriptions ---
    // Salary arrives on the 25th of the prior month
    await prisma.transaction.create({
      data: {
        accountId: checking.id,
        categoryId: categories.Lønn.id,
        bookingDate: new Date(Date.UTC(y, mo - 1, 25)),
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
    await addTx(checking, "Spotify", -99, "CARD", 3);
    await addTx(checking, "Netflix", -179, "CARD", 11);
    await addTx(checking, "Viaplay", -99, "CARD", 17);
    await addTx(
      checking,
      "Gjensidige Forsikring",
      -450,
      "EFT",
      5,
      categories.Forsikring,
    );
    await addTx(checking, "Ruter månedskort", -420, "CARD", 10);
    await addTx(
      checking,
      "Telenor internett",
      -499,
      "EFT",
      18,
      categories["Strøm & Internett"],
    );
    // Electricity is a bill, but the amount follows the season.
    const isWinter = [10, 11, 0, 1].includes(monthNum);
    const isSummer = [5, 6, 7].includes(monthNum);
    await addTx(
      checking,
      "Fjordkraft strøm",
      -(isWinter
        ? kroner(1400, 2300)
        : isSummer
          ? kroner(350, 650)
          : kroner(700, 1200)),
      "EFT",
      20,
      categories["Strøm & Internett"],
    );

    // --- Lønnskonto: everyday spending ---
    const groceryStores = [
      { name: "Rema 1000", min: 180, max: 950 },
      { name: "Kiwi", min: 90, max: 620 },
      { name: "Meny", min: 250, max: 1400 },
      { name: "Coop Extra", min: 150, max: 900 },
    ];
    const groceryTrips = between(7, 11);
    for (let i = 0; i < groceryTrips; i++) {
      const store = pick(groceryStores);
      const amount = kroner(store.min, store.max);
      totals.groceries += amount;
      await addTx(checking, store.name, -amount, "CARD", anyDay());
    }

    const takeaway = [
      { name: "Burger King", min: 140, max: 260 },
      { name: "McDonalds", min: 110, max: 230 },
      { name: "Pizza Hut", min: 230, max: 420 },
      { name: "Sushi restaurant", min: 320, max: 680 },
    ];
    const takeawayVisits = between(1, 5);
    for (let i = 0; i < takeawayVisits; i++) {
      const place = pick(takeaway);
      await addTx(
        checking,
        place.name,
        -kroner(place.min, place.max),
        "CARD",
        anyDay(),
      );
    }

    const chargingSessions = between(2, 5);
    for (let i = 0; i < chargingSessions; i++) {
      const amount = kroner(120, 520);
      totals.charging += amount;
      await addTx(
        checking,
        pick(["Recharge elbil-lading", "Fortum lading"]),
        -amount,
        "CARD",
        anyDay(),
      );
    }
    if (chance(0.4)) {
      await addTx(checking, "Bilvask Shellstasjon", -199, "CARD", anyDay());
    }

    if (chance(0.6)) {
      await addTx(checking, "Apotek 1", -kroner(89, 420), "CARD", anyDay());
    }
    if (chance(0.4)) {
      await addTx(checking, "H&M", -kroner(299, 1199), "CARD", anyDay());
    }
    if (chance(0.5)) {
      await addTx(
        checking,
        "Minibank uttak",
        -pick([500, 1000, 1500]),
        "CASH",
        anyDay(),
        categories.Kontantuttak,
      );
    }

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
      "Renteinntekt Nordea",
      kroner(150, 210),
      "EFT",
      15,
      categories.Renteinntekt,
    );

    // --- Visa Kredittkort ---
    const cardShopping = [
      { name: "Zalando", min: 399, max: 1899 },
      { name: "Elkjøp", min: 249, max: 3999 },
      { name: "Cubus", min: 199, max: 999 },
    ];
    for (const item of pickSome(cardShopping, between(1, 3))) {
      await addTx(
        creditCard,
        item.name,
        -kroner(item.min, item.max),
        "CARD",
        anyDay(),
        categories.Shopping,
      );
    }
    if (chance(0.6)) {
      await addTx(
        creditCard,
        "Restaurant Mathallen",
        -kroner(420, 980),
        "CARD",
        anyDay(),
        categories["Restaurant & Takeaway"],
      );
    }
    if (chance(0.5)) {
      await addTx(
        creditCard,
        "Kino",
        -pick([149, 199, 298, 398]),
        "CARD",
        anyDay(),
        categories.Underholdning,
      );
    }
    if (chance(0.3)) {
      await addTx(
        creditCard,
        "Vitusapotek",
        -kroner(99, 450),
        "CARD",
        anyDay(),
        categories.Helse,
      );
    }

    // --- Brukskonto ---
    const kioskVisits = between(0, 3);
    for (let i = 0; i < kioskVisits; i++) {
      await addTx(
        brukskonto,
        "Narvesen kiosk",
        -kroner(35, 120),
        "CASH",
        anyDay(),
        categories["Restaurant & Takeaway"],
      );
    }
    if (chance(0.5)) {
      await addTx(
        brukskonto,
        "Bondens marked",
        -kroner(150, 420),
        "CASH",
        anyDay(),
        categories.Dagligvarer,
      );
    }
    const parkingStops = between(1, 3);
    for (let i = 0; i < parkingStops; i++) {
      await addTx(
        brukskonto,
        "Parkering",
        -kroner(40, 160),
        "CASH",
        anyDay(),
        categories.Bil,
      );
    }

    // --- Uncategorized ---
    const uncategorized = [
      { account: checking, name: "Ukjent betaling", min: 150, max: 600 },
      { account: checking, name: "Diverse innkjøp", min: 90, max: 450 },
      { account: creditCard, name: "Netthandel ukjent", min: 200, max: 900 },
    ];
    for (const item of pickSome(uncategorized, between(1, 2))) {
      await addTx(
        item.account,
        item.name,
        -kroner(item.min, item.max),
        "CARD",
        anyDay(),
        null,
      );
    }

    // --- Month-specific extras ---
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

    // The card bill pays off whatever was spent on the card this month.
    await addTx(
      checking,
      "Kredittkortbetaling Nordea",
      -(Math.round(totals.creditCard * 100) / 100),
      "TRANSFER",
      28,
      categories.Kredittkortbetaling,
    );

    // --- Monthly Review ---
    await prisma.monthlyReview.create({
      data: {
        monthStart: new Date(Date.UTC(y, mo - 1, 1)),
        status: "GENERATED",
        recap: getMonthlyRecap(monthStart, totals),
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
