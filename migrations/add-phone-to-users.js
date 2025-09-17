const { QueryInterface, DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn('users', 'phone', {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('users', 'phone');
  }
};
