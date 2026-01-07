var options = {
  chart: {
    height: 260,
    type: "area",
    toolbar: {
      show: false,
    },
  },
  dataLabels: {
    enabled: false,
  },
  stroke: {
    curve: "smooth",
    width: 4,
  },
  series: [
    {
      name: "Pharmacy Sales",
      data: [0, 1000, 4000, 3000, 6000, 2000, 3000],
    }
  ],
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
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ],
  },
  yaxis: {
    labels: {
      show: false,
    },
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
  },
};

var chart = new ApexCharts(document.querySelector("#pharmacy"), options);

chart.render();