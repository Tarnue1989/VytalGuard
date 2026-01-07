var options = {
  chart: {
    width: 360,
    type: "pie",
  },
  labels: ["Cardiology", "Orthopedics", "Neurology", "Gastroenterology", "Anatomy"],
  series: [50, 40, 30, 20, 10],
  legend: {
    position: "bottom",
  },
  dataLabels: {
    enabled: false,
  },
  stroke: {
    width: 0,
  },
  colors: [
    "#7367F0", "#7F74F1", "#8B81F3", "#978EF4", "#A39BF5", "#AFA8F7", "#BBB5F8", "#C7C2F9", "#D3CFFB", "#DFDCFC"
  ],
};
var chart = new ApexCharts(document.querySelector("#total-department"), options);
chart.render();