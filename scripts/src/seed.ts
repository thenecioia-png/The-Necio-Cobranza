import { db, usersTable, clientsTable, loansTable, installmentsTable } from "@workspace/db";
import { hashPassword } from "../../artifacts/api-server/src/lib/password";
import { eq } from "drizzle-orm";

function generateInstallmentDates(
  startDate: string,
  count: number,
  frequency: string,
): string[] {
  const dates: string[] = [];
  const base = new Date(startDate);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    if (frequency === "daily") {
      d.setDate(base.getDate() + i);
    } else if (frequency === "weekly") {
      d.setDate(base.getDate() + i * 7);
    } else if (frequency === "biweekly") {
      d.setDate(base.getDate() + i * 14);
    } else {
      d.setMonth(base.getMonth() + i);
    }
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

async function seed() {
  console.log("Seeding database...");

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, "admin")).limit(1);
  if (existing.length === 0) {
    await db.insert(usersTable).values({
      username: "admin",
      passwordHash: hashPassword("admin123"),
      name: "El Necio",
    });
    console.log("Created admin user (username: admin, password: admin123)");
  } else {
    console.log("Admin user already exists");
  }

  const existingClients = await db.select().from(clientsTable).limit(1);
  if (existingClients.length === 0) {
    const today = new Date().toISOString().split("T")[0];

    const [juan] = await db.insert(clientsTable).values({
      name: "Juan Pérez",
      phone: "809-555-0101",
      address: "Calle Principal #5, Santiago",
      cedula: "001-1234567-8",
    }).returning();

    const [maria] = await db.insert(clientsTable).values({
      name: "María García",
      phone: "829-555-0202",
      address: "Ave. Libertad #12, Santo Domingo",
      cedula: "001-9876543-2",
    }).returning();

    const [pedro] = await db.insert(clientsTable).values({
      name: "Pedro Martínez",
      phone: "849-555-0303",
      address: "Los Jardines #8, La Vega",
      cedula: "001-5555555-5",
    }).returning();

    console.log("Created 3 demo clients");

    const loanAmount1 = 5000;
    const interest1 = 20;
    const count1 = 20;
    const total1 = loanAmount1 + (loanAmount1 * interest1 / 100);
    const perInst1 = total1 / count1;

    const [loan1] = await db.insert(loansTable).values({
      clientId: juan.id,
      amount: loanAmount1.toFixed(2),
      interestRate: interest1.toFixed(2),
      installmentsCount: count1,
      startDate: today,
      frequency: "daily",
      totalAmount: total1.toFixed(2),
      status: "active",
    }).returning();

    const dates1 = generateInstallmentDates(today, count1, "daily");
    await db.insert(installmentsTable).values(
      dates1.map((dueDate, i) => ({
        loanId: loan1.id,
        dueDate,
        amount: perInst1.toFixed(2),
        status: i === 0 ? "paid" : "pending",
        paidAt: i === 0 ? new Date() : null,
      }))
    );

    const loanAmount2 = 3000;
    const interest2 = 15;
    const count2 = 10;
    const total2 = loanAmount2 + (loanAmount2 * interest2 / 100);
    const perInst2 = total2 / count2;

    const [loan2] = await db.insert(loansTable).values({
      clientId: maria.id,
      amount: loanAmount2.toFixed(2),
      interestRate: interest2.toFixed(2),
      installmentsCount: count2,
      startDate: today,
      frequency: "daily",
      totalAmount: total2.toFixed(2),
      status: "active",
    }).returning();

    const dates2 = generateInstallmentDates(today, count2, "daily");
    await db.insert(installmentsTable).values(
      dates2.map(dueDate => ({
        loanId: loan2.id,
        dueDate,
        amount: perInst2.toFixed(2),
        status: "pending",
      }))
    );

    const loanAmount3 = 8000;
    const interest3 = 25;
    const count3 = 4;
    const total3 = loanAmount3 + (loanAmount3 * interest3 / 100);
    const perInst3 = total3 / count3;

    const [loan3] = await db.insert(loansTable).values({
      clientId: pedro.id,
      amount: loanAmount3.toFixed(2),
      interestRate: interest3.toFixed(2),
      installmentsCount: count3,
      startDate: today,
      frequency: "weekly",
      totalAmount: total3.toFixed(2),
      status: "active",
    }).returning();

    const dates3 = generateInstallmentDates(today, count3, "weekly");
    await db.insert(installmentsTable).values(
      dates3.map(dueDate => ({
        loanId: loan3.id,
        dueDate,
        amount: perInst3.toFixed(2),
        status: "pending",
      }))
    );

    console.log("Created 3 demo loans with installments");
  } else {
    console.log("Demo data already exists");
  }

  console.log("Seed complete!");
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
