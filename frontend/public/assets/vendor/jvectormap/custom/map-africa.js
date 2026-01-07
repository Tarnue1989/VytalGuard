// Africa
$(function () {
  $("#mapAfrica").vectorMap({
    map: "africa_mill",
    backgroundColor: "transparent",
    scalecolors: ["#7367f0"],
    zoomOnScroll: false,
    zoomMin: 1,
    hoverColor: true,
    series: {
      regions: [
        {
          values: gdpData,
          scale: ["#7367f0"],
          normalizeFunction: "polynomial",
        },
      ],
    },
  });
});
