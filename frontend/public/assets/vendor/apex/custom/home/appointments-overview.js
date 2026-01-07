var options = {
  chart: {
    height: 300,
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
      columnWidth: "40%",
      horizontal: false,
      borderRadius: 6,
      distributed: true,
      dataLabels: {
        position: "center",
      },
    },
  },
  stroke: {
    show: true,
    width: 6,
    colors: ['transparent']
  },
  series: [
    {
      name: "Orders",
      data: [100, 200, 300, 400, 150],
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
      "Male",
      "Female",
      "Boys",
      "Girls",
      "Kids",
    ],
  },
  yaxis: {
    labels: {
      show: false,
    },
  },
  colors: ["#7367F0", "#ff3b41", "#24aa5c", "#ffb037", "#2b81df"],
  markers: {
    size: 0,
    opacity: 0.3,
    colors: ["#7367F0", "#ff3b41", "#24aa5c", "#ffb037", "#2b81df"],
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

var chart = new ApexCharts(document.querySelector("#overview"), options);

chart.render();
