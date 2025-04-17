<script lang="ts" module>
  export interface TeamChartData {
    name: string | undefined;
    data: Array<[number, number]>; // [timestamp, score]
  }

  interface DataPoint {
    x: number | Date;
    y: number;
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import Chart from "chart.js/auto";
  import type { Chart as ChartType, TooltipModel } from "chart.js";
  import {
    TimeScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
  } from "chart.js";
  import "chartjs-adapter-date-fns";

  let {
    data: teamsData,
    extraClasses,
  }: { data: TeamChartData[]; extraClasses?: string } = $props();

  const lineColours: string[] = [
    "#9966FF",
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#4BC0C0",
    "#FF9F40",
    "#8CD867",
    "#EA526F",
    "#23395B",
    "#A0A0A0",
  ];

  let chartContainer: HTMLCanvasElement;
  let scoreboardChart: Chart;

  function prepareChartData() {
    const datasets = teamsData.map((team, index) => {
      return {
        label: team.name,
        data: team.data
          .filter((v) => v[0] != 0)
          .map(([timestamp, score]) => ({
            x: timestamp,
            y: score,
          })),
        borderColor: lineColours[index % lineColours.length],
        backgroundColor: lineColours[index % lineColours.length],
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 0,
      };
    });

    return { datasets };
  }

  const getOrCreateTooltip = (chart: ChartType): HTMLDivElement => {
    let tooltipEl = chart.canvas.parentNode?.querySelector(
      "div.chartjs-tooltip",
    ) as HTMLDivElement;

    if (!tooltipEl) {
      tooltipEl = document.createElement("div");
      tooltipEl.className = "chartjs-tooltip";
      tooltipEl.style.background = "rgba(0, 0, 0, 0.9)";
      tooltipEl.style.borderRadius = "0.5rem";
      tooltipEl.style.color = "white";
      tooltipEl.style.opacity = "1";
      tooltipEl.style.pointerEvents = "none";
      tooltipEl.style.position = "absolute";
      tooltipEl.style.zIndex = "100";
      tooltipEl.style.minWidth = "250px";
      tooltipEl.style.maxHeight = "400px";
      tooltipEl.style.overflowY = "auto";

      const table = document.createElement("table");
      table.style.margin = "0px";
      table.style.width = "100%";

      tooltipEl.appendChild(table);
      chart.canvas.parentNode?.appendChild(tooltipEl);
    }

    return tooltipEl;
  };

  const findLatestPointBefore = (
    dataset: { data: DataPoint[] },
    xValue: number | Date,
  ): { point: DataPoint | null; distance: number } => {
    if (!dataset.data || dataset.data.length === 0) {
      return { point: null, distance: Infinity };
    }

    const xValueNum = xValue instanceof Date ? xValue.getTime() : +xValue;
    const data = dataset.data;

    let low = 0;
    let high = data.length - 1;
    let closestBeforeIdx = -1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const point = data[mid];
      if (!point) break;
      const pointXNum = point.x instanceof Date ? point.x.getTime() : +point.x;

      if (pointXNum <= xValueNum) {
        closestBeforeIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    if (closestBeforeIdx === -1) {
      return { point: null, distance: Infinity };
    }

    const closestPoint = data[closestBeforeIdx]!;
    const pointXNum =
      closestPoint.x instanceof Date
        ? closestPoint.x.getTime()
        : +closestPoint.x;
    const distance = Math.abs(xValueNum - pointXNum);

    return { point: closestPoint, distance };
  };

  const externalTooltipHandler = (context: {
    chart: ChartType;
    tooltip: TooltipModel<"line">;
  }): void => {
    const { chart, tooltip } = context;
    const tooltipEl = getOrCreateTooltip(chart);

    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = "0";
      return;
    }

    let hoveredXValue: number;
    if (tooltip.dataPoints && tooltip.dataPoints.length > 0) {
      const xScale = chart.scales.x!;
      const caretX = tooltip.caretX;
      hoveredXValue = xScale.getValueForPixel(caretX) as number;
    } else {
      tooltipEl.style.opacity = "0";
      return;
    }

    if (tooltip.body) {
      const tableHead = document.createElement("thead");
      const tr = document.createElement("tr");
      tr.style.borderWidth = "0";

      const th = document.createElement("th");
      th.style.borderWidth = "0";
      th.style.textAlign = "center";
      th.style.padding = "4px";

      let titleText = "";
      if (typeof hoveredXValue === "number") {
        titleText = new Date(hoveredXValue).toLocaleString();
      } else {
        titleText = tooltip.title?.[0] || "";
      }

      const text = document.createTextNode(titleText);
      th.appendChild(text);
      tr.appendChild(th);
      tableHead.appendChild(tr);

      const tableBody = document.createElement("tbody");

      let datasetResults: Array<{
        datasetIndex: number;
        label: string;
        point: DataPoint | null;
        backgroundColor: string;
        borderColor: string;
      }> = [];

      chart.data.datasets.forEach((dataset, datasetIndex) => {
        if (chart.getDatasetMeta(datasetIndex).hidden) {
          return;
        }

        const colors = {
          backgroundColor: (dataset.backgroundColor as string) || "#ffffff",
          borderColor: (dataset.borderColor as string) || "#000000",
        };

        const { point } = findLatestPointBefore(
          dataset as unknown as { data: DataPoint[] },
          hoveredXValue,
        );

        datasetResults.push({
          datasetIndex,
          label: (dataset.label as string) || "Dataset " + datasetIndex,
          point,
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
        });
      });

      datasetResults.sort((a, b) => {
        const valueA = a.point?.y ?? -Infinity;
        const valueB = b.point?.y ?? -Infinity;
        return valueB - valueA;
      });

      datasetResults.forEach((result) => {
        const tr = document.createElement("tr");
        tr.style.backgroundColor = "inherit";
        tr.style.borderWidth = "0";

        const td = document.createElement("td");
        td.style.borderWidth = "0";
        td.style.padding = "4px";
        td.style.display = "flex";
        td.style.alignItems = "center";

        const span = document.createElement("span");
        span.style.background = result.backgroundColor;
        span.style.borderColor = result.borderColor;
        span.style.borderWidth = "2px";
        span.style.marginRight = "10px";
        span.style.height = "10px";
        span.style.width = "10px";
        span.style.display = "inline-block";
        span.style.flexShrink = "0";

        const labelSpan = document.createElement("span");
        labelSpan.style.whiteSpace = "nowrap";
        labelSpan.style.overflow = "hidden";
        labelSpan.style.textOverflow = "ellipsis";
        labelSpan.style.maxWidth = "150px";
        labelSpan.style.display = "inline-block";

        const valueSpan = document.createElement("span");
        valueSpan.style.whiteSpace = "nowrap";
        valueSpan.style.marginLeft = "4px";

        if (result.point) {
          const labelText = document.createTextNode(result.label);
          const valueText = document.createTextNode(`: ${result.point.y}`);

          labelSpan.appendChild(labelText);
          valueSpan.appendChild(valueText);

          td.appendChild(span);
          td.appendChild(labelSpan);
          td.appendChild(valueSpan);
          tr.appendChild(td);
          tableBody.appendChild(tr);
        }
      });

      const tableRoot = tooltipEl.querySelector("table");
      if (!tableRoot) return;

      while (tableRoot.firstChild) {
        tableRoot.firstChild.remove();
      }

      tableRoot.appendChild(tableHead);
      tableRoot.appendChild(tableBody);
    }

    const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;

    // @ts-expect-error: it exists
    const { x, y } = tooltip._eventPosition;

    tooltipEl.style.opacity = "1";
    tooltipEl.style.top = `${positionY + y - 40}px`;

    const tooltipWidth = tooltipEl.offsetWidth;
    const rightSidePosition = positionX + x + tooltipWidth + 10;
    const viewportWidth = window.innerWidth;

    if (rightSidePosition > viewportWidth) {
      tooltipEl.style.left = `${positionX + x - 10}px`;
      tooltipEl.style.transform = "translate(-100%, 0)";
    } else {
      tooltipEl.style.left = `${positionX + x + 10}px`;
      tooltipEl.style.transform = "translate(0, 0)";
    }

    const padding = tooltip.options.padding;
    if (typeof padding === "number") {
      tooltipEl.style.padding = `${padding}px`;
    } else {
      tooltipEl.style.padding = "8px";
    }
  };

  onMount(() => {
    Chart.register(
      TimeScale,
      LinearScale,
      PointElement,
      LineElement,
      Title,
      Tooltip,
      Legend,
    );

    const verticalLinePlugin = {
      id: "verticalLine",
      beforeDraw: (chart: ChartType) => {
        // @ts-expect-error: it exists
        if (chart.tooltip?._active?.length) {
          const ctx = chart.ctx;
          // @ts-expect-error: it exists
          const activePoint = chart.tooltip._active[0];
          const x = activePoint.element.x;
          const topY = chart.scales.y!.top;
          const bottomY = chart.scales.y!.bottom;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x, topY);
          ctx.lineTo(x, bottomY);
          ctx.lineWidth = 1;
          ctx.strokeStyle = "rgba(155, 155, 155, 0.8)";
          ctx.stroke();
          ctx.restore();
        }
      },
    };

    const ctx = chartContainer.getContext("2d");

    if (!ctx) {
      console.error("Canvas context not available");
      return;
    }

    scoreboardChart = new Chart(ctx, {
      type: "line",
      data: prepareChartData(),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: "time",
            time: {
              unit: "hour",
              displayFormats: {
                minute: "dd/MM HH:mm",
                hour: "dd/MM HH:mm",
              },
              tooltipFormat: "MMM dd yyyy h:mm a",
            },
            title: {
              display: false,
            },
            grid: {
              display: true,
            },
            ticks: {
              stepSize: 0.5,
              maxRotation: 0,
              minRotation: 0,
            },
          },
          y: {
            title: {
              display: false,
            },
            grid: {
              display: true,
            },
            beginAtZero: true,
          },
        },
        interaction: {
          mode: "nearest",
          axis: "x",
          intersect: false,
        },
        plugins: {
          tooltip: {
            enabled: false,
            mode: "nearest",
            axis: "x",
            intersect: false,
            external: externalTooltipHandler,
          },
          legend: {
            position: "top",
            labels: {
              boxWidth: 25,
              borderRadius: 2,
              useBorderRadius: true,
            },
          },
          title: {
            display: false,
          },
        },
      },
      plugins: [verticalLinePlugin],
    });

    return () => {
      if (scoreboardChart) {
        scoreboardChart.destroy();
      }
    };
  });
</script>

<div class="card bg-base-100 pop w-full p-6 {extraClasses}">
  <canvas bind:this={chartContainer}></canvas>
</div>
