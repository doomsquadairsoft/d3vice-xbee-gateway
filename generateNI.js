const faker = require('faker');

[1, 2, 3, 4, 5, 6, 7, 8].forEach(function(i) {
  console.log(`${i}  ${faker.random.word().toLowerCase().replace(/\s/g, '-')}-${faker.random.word().toLowerCase().replace(/\s/g, '-')}`);
});
