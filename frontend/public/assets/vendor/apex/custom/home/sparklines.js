// Sparkline 1
var options1 = {
  series: [
    {
      data: [10, 10, 15, 15, 20, 20, 25],
    },
  ],
  chart: {
    type: "line",
    height: 50,
    width: 120,
    sparkline: {
      enabled: true,
    },
  },
  stroke: {
    width: 5,
  },
  colors: ["#7367f0"],
  tooltip: {
    fixed: {
      enabled: false,
    },
    x: {
      show: false,
    },
    y: {
      title: {
        formatter: function (seriesName) {
          return "";
        },
      },
    },
    theme: 'dark',
    marker: {
      show: false,
    },
  },
};

var chart1 = new ApexCharts(document.querySelector("#sparkline1"), options1);
chart1.render();

// Sparkline 2
var options2 = {
  series: [
    {
      data: [10, 10, 15, 15, 20, 20, 25],
    },
  ],
  chart: {
    type: "line",
    height: 50,
    width: 120,
    sparkline: {
      enabled: true,
    },
  },
  stroke: {
    width: 5,
  },
  colors: ["#7367f0"],
  tooltip: {
    fixed: {
      enabled: false,
    },
    x: {
      show: false,
    },
    y: {
      title: {
        formatter: function (seriesName) {
          return "";
        },
      },
    },
    theme: 'dark',
    marker: {
      show: false,
    },
  },
};

var chart2 = new ApexCharts(document.querySelector("#sparkline2"), options2);
chart2.render();

// Sparkline 3
var options3 = {
  series: [
    {
      data: [10, 10, 15, 15, 20, 20, 25],
    },
  ],
  chart: {
    type: "line",
    height: 50,
    width: 120,
    sparkline: {
      enabled: true,
    },
  },
  stroke: {
    width: 5,
  },
  colors: ["#7367f0"],
  tooltip: {
    fixed: {
      enabled: false,
    },
    x: {
      show: false,
    },
    y: {
      title: {
        formatter: function (seriesName) {
          return "";
        },
      },
    },
    theme: 'dark',
    marker: {
      show: false,
    },
  },
};

var chart3 = new ApexCharts(document.querySelector("#sparkline3"), options3);
chart3.render();