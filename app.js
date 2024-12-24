require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const Shopify = require('shopify-api-node');
const cors = require('cors');  // CORS import karna

const app = express();

// CORS ko use karna
app.use(cors()); // Yeh CORS middleware sab routes par apply hoga
app.use(express.static('public'));
app.use(bodyParser.json()); // Parse incoming JSON data

// Initialize Shopify API
const shopify = new Shopify({
  shopName: process.env.SHOPIFY_SHOP_NAME,
  apiKey: process.env.SHOPIFY_API_KEY,
  password: process.env.SHOPIFY_API_PASSWORD
});

// Function to check if email or phone already exists
async function isCustomerExist(email, phone) {
  try {
    const customersByEmail = await shopify.customer.search({ query: `email:${email}` });
    const customersByPhone = await shopify.customer.search({ query: `phone:${phone}` });

    if (customersByEmail.length > 0) {
      return { exists: true, reason: 'email' };
    }

    if (customersByPhone.length > 0) {
      return { exists: true, reason: 'phone' };
    }

    return { exists: false };
  } catch (error) {
    console.error('Error checking customer existence:', error.message);
    return { exists: false };
  }
}

// Function to create a customer
async function createCustomer(formData) {
  try {
    const customerExist = await isCustomerExist(formData.email, formData.phone);

    if (customerExist.exists) {
      return { success: false, error: `Customer with the same ${customerExist.reason} already exists.` };
    }

    const customer = await shopify.customer.create({
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email,
      phone: formData.phone,
      verified_email: true,
      password: formData.password,
      password_confirmation: formData.confirm_password,
      send_email_welcome: true
    });

    console.log(`Customer created: ${customer.id}`);

    await createCustomerMetafields(customer.id, formData);

    return { success: true, customer_id: customer.id };
  } catch (error) {
    console.error('Error creating customer:', error.message);
    return { success: false, error: error.message };
  }
}

// Function to create metafields
async function createCustomerMetafields(customerId, formData) {
  try {
    const metafields = [
      { namespace: 'custom', key: 'website_social', value: formData.website_social || '', type: 'single_line_text_field' },
      { namespace: 'custom', key: 'when_purchasing_wholesale_products', value: formData.when_purchasing_wholesale_products || '', type: 'single_line_text_field' },
      { namespace: 'custom', key: 'want_to_sell_more_of', value: formData.want_to_sell_more_of || '', type: 'single_line_text_field' },
      { namespace: 'custom', key: 'top_categories', value: formData.categories || '', type: 'single_line_text_field' },
      { namespace: 'custom', key: 'business_name', value: formData.store_name || '', type: 'single_line_text_field' },
      { namespace: 'custom', key: 'business_type', value: formData.business || '', type: 'single_line_text_field' }
    ];

    for (const metafield of metafields) {
      try {
        console.log(`Creating metafield: ${metafield.key}`, metafield);

        await shopify.metafield.create({
          owner_resource: 'customer',
          owner_id: customerId,
          namespace: metafield.namespace,
          key: metafield.key,
          value: metafield.value,
          type: metafield.type
        });

        console.log(`Metafield created successfully: ${metafield.key}`);
      } catch (error) {
        console.error(`Failed to create metafield: ${metafield.key}`);
        console.error(`Error: ${JSON.stringify(error.response?.body || error.message, null, 2)}`);
      }
    }
  } catch (error) {
    console.error("Error creating metafields:", error.message);
  }
}

// Route to handle form submission
app.post('/submit-form', async (req, res) => {
  const formData = req.body;

  console.log('Form data received:', formData);

  const response = await createCustomer(formData);

  if (response.success) {
    res.json({
      message: 'Customer created successfully!',
      customer_id: response.customer_id
    });
  } else {
    res.status(400).json({
      message: 'Failed to create customer',
      error: response.error
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
