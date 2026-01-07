var options = {
  chart: {
    height: 250,
    type: "area",
    toolbar: {
      show: false,
    },
  },
  dataLabels: {
    enabled: false,
  },

  plotOptions: {
    bar: {
      columnWidth: "60%",
      borderRadius: 2,
    },
  },
  stroke: {
    show: true,
    width: 0,
    colors: ['transparent']
  },
  series: [
    {
      name: "Appointments",
      type: "column",
      data: [10, 40, 15, 40, 20, 35, 20, 10, 31, 43, 56, 29],
    },
    {
      name: "Surgeries",
      type: "area",
      data: [2, 8, 25, 7, 20, 20, 51, 35, 42, 20, 33, 67],
    },
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
  colors: ["#7367F0", "#7F74F1", "#8B81F3", "#978EF4", "#A39BF5", "#AFA8F7", "#BBB5F8", "#C7C2F9", "#D3CFFB", "#DFDCFC"],
  markers: {
    size: 0,
    opacity: 0.3,
    colors: ["#7367F0", "#7F74F1", "#8B81F3", "#978EF4", "#A39BF5", "#AFA8F7", "#BBB5F8", "#C7C2F9", "#D3CFFB", "#DFDCFC"],
    strokeColor: "#ffffff",
    strokeWidth: 2,
    hover: {
      size: 7,
    },
  },
  tooltip: {
    y: {
      formatter: function (val) {
        return '$' + val + 'k';
      },
    },
  },
};

var chart = new ApexCharts(document.querySelector("#income"), options);

chart.render();