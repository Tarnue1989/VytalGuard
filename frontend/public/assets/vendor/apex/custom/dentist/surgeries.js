var options1 = {
  chart: {
    height: 170,
    type: 'radar',
    toolbar: {
      show: false,
    },
    offsetY: 0
  },
  series: [{
    name: 'Total Surgeries',
    data: [25, 98, 56, 22, 75, 19, 86],
  }],
  labels: ['General', 'Hernia', 'Plastic', 'Trauma', 'Endocrine', 'Bariatric', 'Orthopedic'],
  plotOptions: {
    radar: {
      size: 60,
      polygons: {
        fill: {
          colors: ["#7367F0", "#7F74F1", "#8B81F3", "#978EF4", "#A39BF5", "#AFA8F7", "#BBB5F8", "#C7C2F9", "#D3CFFB", "#DFDCFC"]
        },
      }
    }
  },
  colors: ["#7367F0", "#7F74F1", "#8B81F3", "#978EF4", "#A39BF5", "#AFA8F7", "#BBB5F8", "#C7C2F9", "#D3CFFB", "#DFDCFC"],
  stroke: {
    width: 2,
    curve: 'straight',
  },
  markers: {
    size: 4,
    strokeColor: ["#7367F0", "#7F74F1", "#8B81F3", "#978EF4", "#A39BF5", "#AFA8F7", "#BBB5F8", "#C7C2F9", "#D3CFFB", "#DFDCFC"],
    colors: ['#fff'],
    strokeWidth: 1,
  },
  grid: {
    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  },
  tooltip: {
    y: {
      formatter: function (val) {
        return val
      }
    },
    theme: 'dark',
  },
  yaxis: {
    tickAmount: 6,
    labels: {
      formatter: function (val, i) {
        if (i % 5 === 0) {
          return val
        }
      }
    }
  }
}
var chart = new ApexCharts(document.querySelector("#surgeries"), options1);
chart.render();