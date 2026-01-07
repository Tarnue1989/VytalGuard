// Europe
$(function () {
  $("#mapEurope").vectorMap({
    map: "europe_mill",
    zoomOnScroll: false,
    series: {
      regions: [
        {
          values: gdpData,
          scale: ["#7367f0"],
          normalizeFunction: "polynomial",
        },
      ],
    },
    backgroundColor: "transparent",
  });
});
