var options = {
  series: [{
    name: 'Male',
    data: [80, 50, 30, 40, 100, 20],
  }, {
    name: 'Female',
    data: [20, 30, 40, 80, 20, 80],
  }, {
    name: 'Kids',
    data: [44, 76, 78, 13, 43, 10],
  }],
  chart: {
    height: 275,
    type: 'radar',
    toolbar: {
      show: false,
    },
  },
  legend: {
    position: "bottom",
  },
  dataLabels: {
    enabled: false,
  },
  stroke: {
    width: 2
  },
  fill: {
    opacity: 0.1
  },
  markers: {
    size: 0
  },
  yaxis: {
    stepSize: 20
  },
  colors: ["#7367F0", "#7F74F1", "#8B81F3", "#978EF4", "#A39BF5", "#AFA8F7", "#BBB5F8", "#C7C2F9", "#D3CFFB", "#DFDCFC"],
  xaxis: {
    categories: ['0-5', '6-10', '11-20', '21-30', '31-50', '51+']
  }
};

var chart = new ApexCharts(document.querySelector("#gender"), options);
chart.render();