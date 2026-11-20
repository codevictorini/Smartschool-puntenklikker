(() => {
  const figures = Object.freeze({
    classic: `
      <path d="M133 63c-12-3-19-13-17-26-10 4-21-1-25-11C65 8 34 19 20 45 6 70 14 104 39 120c25 16 61 9 77-16 8-12 12-27 17-41Z" fill="#e6aa50" stroke="#382b21" stroke-linejoin="round" stroke-width="5"/>
      <g fill="#70452d">
        <circle cx="52" cy="51" r="6"/><circle cx="83" cy="39" r="5"/>
        <circle cx="45" cy="82" r="5"/><circle cx="80" cy="72" r="7"/>
        <circle cx="104" cy="91" r="5"/><circle cx="65" cy="103" r="4"/>
      </g>`,
    berry: `
      <path d="M80 55c-12-16-34-12-34 5 0 15 23 38 31 64 1 4 5 4 6 0 8-26 31-49 31-64 0-17-22-21-34-5Z" fill="#e84d68" stroke="#9e304b" stroke-linejoin="round" stroke-width="4"/>
      <path d="M80 55c-7-13-21-19-34-16 5 12 16 19 31 20-2-12 2-21 12-29 1 12 7 20 18 23 4-12 13-17 26-18-5 15-17 23-38 25Z" fill="#39835b" stroke="#286743" stroke-linejoin="round" stroke-width="3"/>
      <g fill="#ffe08a">
        <ellipse cx="62" cy="69" rx="2" ry="3" transform="rotate(-20 62 69)"/>
        <ellipse cx="82" cy="72" rx="2" ry="3" transform="rotate(10 82 72)"/>
        <ellipse cx="101" cy="69" rx="2" ry="3" transform="rotate(20 101 69)"/>
        <ellipse cx="71" cy="91" rx="2" ry="3" transform="rotate(-12 71 91)"/>
        <ellipse cx="91" cy="95" rx="2" ry="3" transform="rotate(12 91 95)"/>
        <ellipse cx="80" cy="113" rx="2" ry="3"/>
      </g>`,
    mint: `
      <path d="M76 124C35 106 35 62 72 42c23 22 25 54 4 82Z" fill="#72bd80" stroke="#286743" stroke-linejoin="round" stroke-width="4"/>
      <path d="M84 124c-8-43 17-73 57-63 2 35-18 59-57 63Z" fill="#3f9164" stroke="#286743" stroke-linejoin="round" stroke-width="4"/>
      <path d="m76 116-17-52m26 58 38-47m-25 30 20-5" fill="none" stroke="#d9f3c8" stroke-linecap="round" stroke-width="4"/>`,
    night: `
      <path d="m80 16 17 43 46 3-35 30 12 45-40-25-40 25 12-45-35-30 46-3Z" fill="#f3c94c" stroke="#9b7621" stroke-linejoin="round" stroke-width="5"/>
      <path d="m34 35 4 10 11 1-8 7 2 11-9-6-9 6 2-11-8-7 11-1Z" fill="#ffe89a"/>
      <circle cx="126" cy="108" r="5" fill="#fff1b8"/>`,
    watermelon: `
      <path d="M23 51a57 57 0 0 0 114 0Z" fill="#39835b" stroke="#245d40" stroke-linejoin="round" stroke-width="5"/>
      <path d="M37 54a43 43 0 0 0 86 0Z" fill="#f25b62"/>
      <path d="M47 54a33 33 0 0 0 4 17m58-17a33 33 0 0 1-4 17" fill="none" stroke="#d3ed9b" stroke-linecap="round" stroke-width="4"/>
      <g fill="#503239">
        <ellipse cx="63" cy="72" rx="3" ry="6" transform="rotate(-25 63 72)"/>
        <ellipse cx="81" cy="82" rx="3" ry="6"/>
        <ellipse cx="99" cy="72" rx="3" ry="6" transform="rotate(25 99 72)"/>
      </g>`,
    orange: `
      <circle cx="80" cy="83" r="53" fill="#f59a31" stroke="#bb5a25" stroke-width="5"/>
      <circle cx="80" cy="83" r="42" fill="#ffbf52" stroke="#ffe3a2" stroke-width="4"/>
      <path d="M80 42v82M39 83h82M51 54l58 58m0-58-58 58" stroke="#fff0c7" stroke-linecap="round" stroke-width="4"/>
      <path d="M78 30c2-17 20-24 34-18-4 15-17 23-33 22Z" fill="#438552" stroke="#286743" stroke-width="3"/>
      <path d="M78 34c-3-12-12-18-23-17 2 12 10 19 23 20Z" fill="#69a85e" stroke="#286743" stroke-width="3"/>`,
    donut: `
      <path d="M80 22a58 58 0 1 0 0 116 58 58 0 1 0 0-116Zm0 37a21 21 0 1 1 0 42 21 21 0 1 1 0-42Z" fill="#bd7e49" fill-rule="evenodd" stroke="#70452d" stroke-width="5"/>
      <path d="M31 57c7-20 24-33 48-35 24 0 43 14 50 33l-9 11-8-6-9 10-11-8-11 8-11-7-12 9-10-8-11 7-10-8Z" fill="#f08db0" stroke="#bd587c" stroke-linejoin="round" stroke-width="3"/>
      <g fill="#fff2a6">
        <rect x="48" y="46" width="12" height="4" rx="2" transform="rotate(25 48 46)"/>
        <rect x="79" y="35" width="12" height="4" rx="2" transform="rotate(-18 79 35)"/>
        <rect x="105" y="48" width="12" height="4" rx="2" transform="rotate(35 105 48)"/>
      </g>`,
    cupcake: `
      <path d="M45 79h70l-9 54H54Z" fill="#7aa6d8" stroke="#3b5f91" stroke-linejoin="round" stroke-width="5"/>
      <path d="M58 91h45M60 106h40M63 120h34" stroke="#c5e1ff" stroke-linecap="round" stroke-width="5"/>
      <path d="M44 79c-13-5-7-25 9-24-5-16 10-27 22-18 1-18 30-18 31 1 15-7 28 10 19 22 16 2 16 20 2 19Z" fill="#f5a3c2" stroke="#b75b83" stroke-linejoin="round" stroke-width="4"/>
      <circle cx="80" cy="30" r="10" fill="#db4555" stroke="#9e304b" stroke-width="3"/>
      <path d="M79 20c0-7 5-11 12-11" fill="none" stroke="#39835b" stroke-linecap="round" stroke-width="4"/>`,
  });
  window.PuntKlikFigures = figures;
})();
