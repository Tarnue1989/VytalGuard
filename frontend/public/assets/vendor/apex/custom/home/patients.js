var options = {
  chart: {
    height: 235,
    type: "line",
    toolbar: {
      show: false,
    },
  },
  dataLabels: {
    enabled: false,
  },
  fill: {
    type: 'solid',
    opacity: [0.1, 1],
  },
  stroke: {
    curve: "smooth",
    width: [0, 5]
  },
  series: [{
    name: 'New',
    type: 'area',
    data: [400, 500, 400, 600, 500, 600, 500, 700, 600, 800, 700, 900]
  }, {
    name: 'Return',
    type: 'line',
    data: [300, 400, 500, 600, 400, 500, 400, 600, 400, 600, 600, 800]
  }],
  grid: {
    borderColor: "#d8dee6",
    strokeDashArray: 5,
    xaxis: {
      lines: {
        show: true,
      },
    },
    yaxis: {
      lines: {
        show: false,
      },
    },
    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  },
  xaxis: {
    categories: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
  },
  yaxis: {
    labels: {
      show: false,
    },
  },
  legend: {
    position: 'bottom',
    horizontalAlign: 'center',
  },
  colors: ["#7367F0", "#7F74F1", "#8B81F3", "#978EF4", "#A39BF5", "#AFA8F7", "#BBB5F8", "#C7C2F9", "#D3CFFB", "#DFDCFC"],
  markers: {
    size: 0,
    opacity: 0.3,
    colors: ["#7367F0", "#7F74F1", "#8B81F3", "#978EF4", "#A39BF5", "#AFA8F7", "#BBB5F8", "#C7C2F9", "#D3CFFB", "#DFDCFC"],
    strokeColor: "#ffffff",
    strokeWidth: 1,
    hover: {
      size: 7,
    },
  },
  tooltip: {
    y: {
      formatter: function (val) {
        return val;
      },
    },
    theme: 'dark',
  },
};

var chart = new ApexCharts(document.querySelector("#patients"), options);

chart.render();