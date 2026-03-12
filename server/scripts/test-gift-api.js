const fetch = require('node-fetch');

async function test() {
  const BASE_URL = 'http://localhost:3000/api';
  console.log('Testing Gift API via', BASE_URL);

  try {
    // 1. Create a gift
    const createRes = await fetch(`${BASE_URL}/gifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: "Test Birthday Gift",
        description: "A test gift for verification",
        created_by: 1
      })
    });
    const gift = await createRes.json();
    console.log('Gift created:', gift);

    if (!gift.id) throw new Error('Gift creation failed');

    // 2. Add an item
    const addItemRes = await fetch(`${BASE_URL}/gifts/${gift.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: "Chocolate Cake",
        estimated_price: 250000
      })
    });
    const item = await addItemRes.json();
    console.log('Item added:', item);

    // 3. Join the gift
    const joinRes = await fetch(`${BASE_URL}/gifts/${gift.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id: 1,
        contribution_amount: 0
      })
    });
    const part = await joinRes.json();
    console.log('Member joined:', part);

    // 4. Get detail
    const detailRes = await fetch(`${BASE_URL}/gifts/${gift.id}`);
    const detail = await detailRes.json();
    console.log('Gift detail:', {
      id: detail.id,
      items: detail.items.length,
      participants: detail.participants.length
    });

    console.log('API Verification SUCCESSFUL');
  } catch (err) {
    console.error('API Verification FAILED:', err.message);
    process.exit(1);
  }
}

test();
