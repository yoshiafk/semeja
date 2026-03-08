import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

// Connect to the database using the same default fallback as db.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_gIlw9tQGra2k@ep-twilight-band-a1ha377k-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
});

const sampleDishes = [
  // --- LAUK ---
  {
    name: "Ayam Goreng Lengkuas",
    description: "Ayam goreng tradisional khas Nusantara dengan rempah lengkuas.",
    category: "Lauk",
    ingredients: [
      { name: "Ayam Negeri", unit: "ekor", quantity: 0.25 },
      { name: "Lengkuas", unit: "ruas", quantity: 1 },
      { name: "Bawang Putih", unit: "siung", quantity: 2 },
      { name: "Kunyit", unit: "ruas", quantity: 0.5 }
    ]
  },
  {
    name: "Rendang Daging Sapi",
    description: "Olahan daging sapi otentik khas Padang.",
    category: "Lauk",
    ingredients: [
      { name: "Daging Sapi", unit: "kg", quantity: 0.15 },
      { name: "Santan Kental", unit: "liter", quantity: 0.2 },
      { name: "Bumbu Rendang Jadi", unit: "bungkus", quantity: 0.5 }
    ]
  },
  {
    name: "Ikan Nila Bakar Pedas Manis",
    description: "Ikan Nila bakar bumbu kecap pedas.",
    category: "Lauk",
    ingredients: [
      { name: "Ikan Nila", unit: "ekor", quantity: 1 },
      { name: "Kecap Manis", unit: "sdm", quantity: 2 },
      { name: "Cabai Rawit Merah", unit: "buah", quantity: 3 },
      { name: "Jeruk Nipis", unit: "buah", quantity: 0.5 }
    ]
  },

  // --- SAYUR ---
  {
    name: "Sayur Asem Jakarta",
    description: "Sayur asam segar dengan cita rasa khas Betawi.",
    category: "Sayur",
    ingredients: [
      { name: "Jagung Manis", unit: "buah", quantity: 0.5 },
      { name: "Kacang Panjang", unit: "ikat", quantity: 0.25 },
      { name: "Labu Siam", unit: "buah", quantity: 0.25 },
      { name: "Melinjo", unit: "genggam", quantity: 0.5 },
      { name: "Bumbu Sayur Asem", unit: "bungkus", quantity: 0.5 }
    ]
  },
  {
    name: "Capcay Kuah Seafood",
    description: "Tumis sayuran campur dengan udang dan bakso.",
    category: "Sayur",
    ingredients: [
      { name: "Wortel", unit: "buah", quantity: 0.5 },
      { name: "Sawi Putih", unit: "lembar", quantity: 3 },
      { name: "Kembang Kol", unit: "bonggol", quantity: 0.2 },
      { name: "Udang Kupas", unit: "gram", quantity: 50 },
      { name: "Bawang Putih", unit: "siung", quantity: 1.5 }
    ]
  },
  {
    name: "Tumis Kangkung Terasi",
    description: "Tumis kangkung sederhana dengan aroma bumbu terasi.",
    category: "Sayur",
    ingredients: [
      { name: "Kangkung", unit: "ikat", quantity: 0.5 },
      { name: "Terasi Udang", unit: "sdt", quantity: 0.5 },
      { name: "Cabai Merah Keriting", unit: "buah", quantity: 2 },
      { name: "Bawang Merah", unit: "siung", quantity: 2 }
    ]
  },

  // --- DESSERT ---
  {
    name: "Es Buah Susu Campur",
    description: "Es campur segar dengan buah musiman dan susu kental manis.",
    category: "Dessert",
    ingredients: [
      { name: "Melon", unit: "potong", quantity: 0.5 },
      { name: "Semangka", unit: "potong", quantity: 0.5 },
      { name: "Nata de Coco", unit: "sdm", quantity: 2 },
      { name: "Susu Kental Manis", unit: "sdm", quantity: 2 }
    ]
  },
  {
    name: "Pisang Coklat Lumer (Piscok)",
    description: "Pisang goreng balut kulit lumpia dengan isian coklat.",
    category: "Dessert",
    ingredients: [
      { name: "Pisang Uli", unit: "buah", quantity: 1 },
      { name: "Kulit Lumpia", unit: "lembar", quantity: 1 },
      { name: "Coklat Meses", unit: "sdm", quantity: 1 },
      { name: "Minyak Goreng", unit: "liter", quantity: 0.05 }
    ]
  },
  {
    name: "Puding Mangga Vanila",
    description: "Puding lapis rasa manis mangga dengan lapisan susu",
    category: "Dessert",
    ingredients: [
      { name: "Nutrijel Mangga", unit: "bungkus", quantity: 0.25 },
      { name: "Susu UHT", unit: "liter", quantity: 0.1 },
      { name: "Gula Pasir", unit: "sdm", quantity: 1.5 }
    ]
  }
];

async function seedData() {
  const client = await pool.connect();
  
  try {
    console.log("Starting menu seeding process...");
    await client.query('BEGIN');

    for (const dish of sampleDishes) {
      // 1. Insert Recipe
      console.log(`Inserting: ${dish.name} (${dish.category})`);
      const { rows: recipeRows } = await client.query(
        'INSERT INTO recipes (name, description, category, source_url) VALUES ($1, $2, $3, $4) ON CONFLICT (name) DO NOTHING RETURNING id',
        [dish.name, dish.description, dish.category, ""]
      );
      
      let recipeId;
      if (recipeRows.length > 0) {
        recipeId = recipeRows[0].id;
      } else {
        // Recipe already exists, find its ID
        const { rows: existingRecipe } = await client.query('SELECT id FROM recipes WHERE name = $1', [dish.name]);
        recipeId = existingRecipe[0].id;
        console.log(`- Recipe '${dish.name}' already exists, skipping duplicate creation.`);
        continue; // Assume ingredients are already seeded for this recipe to avoid dupes
      }

      // 2. Map Ingredients
      for (const ing of dish.ingredients) {
        // Find existing ingredient or create new
        let ingredientId;
        const { rows: existingIng } = await client.query('SELECT id FROM ingredients WHERE name ILIKE $1 LIMIT 1', [ing.name]);
        
        if (existingIng.length > 0) {
            ingredientId = existingIng[0].id;
        } else {
            const { rows: newIng } = await client.query(
                "INSERT INTO ingredients (name, unit, price_per_unit, category) VALUES ($1, $2, 0, 'Lainnya') RETURNING id",
                [ing.name, ing.unit]
            );
            ingredientId = newIng[0].id;
        }

        // Link ingredient to recipe
        await client.query(
            'INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity_per_person, custom_unit, name) VALUES ($1, $2, $3, $4, $5)',
            [recipeId, ingredientId, ing.quantity, ing.unit, ing.name]
        );
      }
    }

    await client.query('COMMIT');
    console.log("Successfully seeded menus and ingredients!");
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Failed to seed database: ", error);
  } finally {
    client.release();
    pool.end();
  }
}

seedData();
