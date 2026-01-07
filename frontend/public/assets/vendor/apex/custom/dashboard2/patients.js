var options = {
  chart: {
    height: 260,
    type: "bar",
    toolbar: {
      show: false,
    },
  },
  dataLabels: {
    enabled: false,
  },
  plotOptions: {
    bar: {
      columnWidth: "20%",
      borderRadius: 6,
    },
  },
  stroke: {
    width: 5,
  },
  series: [
    {
      name: "Patients",
      data: [0, 20, 70, 25, 100, 90, 160],
    }
  ],
  grid: {
    borderColor: "#a7cfcd",
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
  colors: ["#7367f0", "#d3e7e6", "#e9f3f2"],
  markers: {
    size: 0,
    opacity: 0.3,
    colors: ["#7367f0", "#d3e7e6", "#e9f3f2"],
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

var chart = new ApexCharts(document.querySelector("#weeklyPatients"), options);

chart.render();