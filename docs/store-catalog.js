(() => {
  'use strict';

  const catalog = [
    { key: 'figure:classic', type: 'figure', id: 'classic', name: 'Koek', note: 'Startfiguur', price: 0 },
    { key: 'figure:berry', type: 'figure', id: 'berry', name: 'Aardbei', note: 'Een losse aardbei', price: 15 },
    { key: 'figure:mint', type: 'figure', id: 'mint', name: 'Muntblaadje', note: 'Een fris blaadje', price: 25 },
    { key: 'figure:night', type: 'figure', id: 'night', name: 'Ster', note: 'Een gouden ster', price: 40 },
    { key: 'figure:watermelon', type: 'figure', id: 'watermelon', name: 'Watermeloen', note: 'Een sappig partje', price: 20 },
    { key: 'figure:orange', type: 'figure', id: 'orange', name: 'Sinaasappel', note: 'Een citruswiel', price: 20 },
    { key: 'figure:donut', type: 'figure', id: 'donut', name: 'Donut', note: 'Met roze glazuur', price: 30 },
    { key: 'figure:cupcake', type: 'figure', id: 'cupcake', name: 'Cupcake', note: 'Met een kers erbovenop', price: 35 },
    { key: 'topping:sprinkles', type: 'topping', id: 'sprinkles', name: 'Regenboogsprinkles', note: '+10% coins', price: 25 },
    { key: 'topping:chocolate', type: 'topping', id: 'chocolate', name: 'Chocoladesaus', note: '+25% coins', price: 50 },
    { key: 'topping:gold', type: 'topping', id: 'gold', name: 'Goudstof', note: '+50% coins', price: 100 },
  ];

  window.PuntKlikStoreCatalog = Object.freeze(catalog.map((item) => Object.freeze(item)));
})();
