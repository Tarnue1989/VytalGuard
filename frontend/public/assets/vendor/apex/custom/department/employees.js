var options = {
  chart: {
    height: 300,
    width: '100%',
    type: 'bar',
    toolbar: {
      show: false,
    },
  },
  plotOptions: {
    bar: {
      horizontal: false,
      distributed: true,
      columnWidth: '50%',
      borderRadius: 4,
    },
  },
  dataLabels: {
    enabled: false
  },
  stroke: {
    show: true,
    width: 0,
    colors: [
      "#7367F0", "#7F74F1", "#8B81F3", "#978EF4", "#A39BF5", "#AFA8F7", "#BBB5F8", "#C7C2F9", "#D3CFFB", "#DFDCFC"]
  },
  series: [{
    name: 'Contract',
    data: [2000, 4000, 8000, 12000, 9000]
  }],
  legend: {
    show: false,
  },
  xaxis: {
    categories: ["Cardiology", "Orthopedics", "Neurology", "Gastroenterology", "Anatomy"],
  },
  yaxis: {
    show: false,
  },
  fill: {
    colors: [
      "#7367F0", "#7F74F1", "#8B81F3", "#978EF4", "#A39BF5", "#AFA8F7", "#BBB5F8", "#C7C2F9", "#D3CFFB", "#DFDCFC"],
  },
  tooltip: {
    y: {
      formatter: function (val) {
        return + val
      }
    }
  },
  grid: {
    show: false,
    xaxis: {
      lines: {
        show: true
      }
    },
    yaxis: {
      lines: {
        show: false,
      }
    },
  },
  colors: ['#ffffff'],
}
var chart = new ApexCharts(
  document.querySelector("#employees"),
  options
);
chart.render();