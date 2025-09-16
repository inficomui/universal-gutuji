const { sequelize } = require('./utils/db.ts');

async function checkSchema() {
  try {
    await sequelize.authenticate();
    console.log('Database connected successfully');
    
    // Get table description
    const [results] = await sequelize.query("DESCRIBE users");
    console.log('Users table columns:');
    results.forEach(row => {
      console.log(`- ${row.Field}: ${row.Type} (${row.Null === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check if position column exists
    const positionColumn = results.find(row => row.Field === 'position');
    if (positionColumn) {
      console.log('\n✅ Position column exists!');
      console.log(`Type: ${positionColumn.Type}`);
      console.log(`Default: ${positionColumn.Default}`);
    } else {
      console.log('\n❌ Position column does NOT exist!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

checkSchema();
