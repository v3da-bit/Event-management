import "reflect-metadata";
import { config } from "dotenv";
import mongoose from "mongoose";
import { hash } from "bcryptjs";
import { models } from "./common/schemas";
config({ path: ".env" });
config({ path: "apps/backend/.env" });
async function seed() {
  if (!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length < 10)
    throw new Error(
      "Set SEED_PASSWORD (10+ characters) to seed demonstration accounts",
    );
  await mongoose.connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/everafter",
  );
  for (const m of models) mongoose.model(m.name, m.schema);
  const User = mongoose.model("User");
  const Event = mongoose.model("Event");
  const Wishlist = mongoose.model("Wishlist");
  const Participant = mongoose.model("Participant");
  const passwordHash = await hash(process.env.SEED_PASSWORD, 12);
  const groom = await User.findOneAndUpdate(
    { email: "aarav@example.com" },
    {
      $setOnInsert: {
        fullName: "Aarav Sharma",
        email: "aarav@example.com",
        team: "GROOM",
        passwordHash,
      },
    },
    { new: true, upsert: true },
  );
  const bride = await User.findOneAndUpdate(
    { email: "ananya@example.com" },
    {
      $setOnInsert: {
        fullName: "Ananya Patel",
        email: "ananya@example.com",
        team: "BRIDE",
        passwordHash,
      },
    },
    { new: true, upsert: true },
  );
  const rows = [
    {
      title: "Mehendi & memories",
      team: "BRIDE",
      date: "2027-02-12T09:30:00Z",
      location: "The Garden Courtyard, Jaipur",
      description:
        "An afternoon of intricate henna, happy hearts, and a little dancing. Come dressed in your favourite shades of green.",
      coverImage:
        "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1000&q=85",
      tasks: [
        "Book the mehendi artists",
        "Arrange floral seating",
        "Prepare welcome drinks",
        "Choose the playlist",
      ],
    },
    {
      title: "A golden kind of haldi",
      team: "GROOM",
      date: "2027-02-13T04:30:00Z",
      location: "The Sunlit Terrace, Jaipur",
      description:
        "A splash of sunshine, a pinch of turmeric, and all our favourite people. Let’s paint the morning yellow.",
      coverImage:
        "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1000&q=85",
      tasks: [
        "Arrange turmeric and flowers",
        "Confirm the photographer",
        "Prepare yellow outfits",
        "Organize guest transport",
      ],
    },
    {
      title: "Sangeet under the stars",
      team: "BRIDE",
      date: "2027-02-13T13:30:00Z",
      location: "The Palace Lawns, Jaipur",
      description:
        "Two families, one dance floor. An evening of music, laughter, and performances we’ll be talking about for years.",
      tasks: [
        "Finalize dance performances",
        "Book the sound system",
        "Confirm dinner menu",
        "Arrange stage decoration",
        "Prepare welcome gifts",
      ],
    },
    {
      title: "The wedding ceremony",
      team: "GROOM",
      date: "2027-02-15T04:30:00Z",
      location: "The Royal Pavilion, Jaipur",
      description:
        "The beginning of our forever. Join us for a traditional wedding ceremony filled with love, blessings, and beautiful new beginnings.",
      tasks: [
        "Finalize venue decoration",
        "Confirm photographer",
        "Book catering service",
        "Arrange guest transportation",
        "Prepare welcome gifts",
      ],
    },
    {
      title: "A toast to forever",
      team: "GROOM",
      date: "2027-02-15T13:00:00Z",
      location: "The Grand Ballroom, Jaipur",
      description:
        "Good food, warm wishes, and a dance or two. Celebrate the newlyweds with an evening to remember.",
      tasks: [
        "Confirm the cake",
        "Plan seating arrangements",
        "Prepare thank-you notes",
      ],
    },
    {
      title: "Brunch with our people",
      team: "BRIDE",
      date: "2027-02-16T05:30:00Z",
      location: "The Rose Garden, Jaipur",
      description:
        "One last cup of chai before we say goodbye. A slow morning of shared stories and full hearts.",
      tasks: [
        "Choose the brunch menu",
        "Arrange farewell gifts",
        "Confirm airport transfers",
      ],
    },
  ];
  for (const [index, row] of rows.entries()) {
    const user = row.team === "GROOM" ? groom : bride;
    let event = await Event.findOne({ title: row.title });
    if (event) continue;
    event = await Event.create({
      title: row.title,
      team: row.team,
      description: row.description,
      startDate: new Date(row.date),
      endDate: new Date(new Date(row.date).getTime() + 3 * 3600000),
      timezone: "Asia/Kolkata",
      location: row.location,
      coverImage: row.coverImage,
      createdBy: user!._id,
    });
    await Wishlist.insertMany(
      row.tasks.map((title, i) => ({
        eventId: event!._id,
        title,
        createdBy: user!._id,
        isCompleted: i < (index % 3) + 1,
        ...(i < (index % 3) + 1
          ? { completedBy: user!._id, completedAt: new Date() }
          : {}),
      })),
    );
    for (const u of [groom, bride])
      await Participant.create({ eventId: event._id, userId: u!._id });
  }
  console.log(
    "Seed complete. Sign in as aarav@example.com or ananya@example.com using SEED_PASSWORD. Existing accounts are preserved.",
  );
  await mongoose.disconnect();
}
seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
