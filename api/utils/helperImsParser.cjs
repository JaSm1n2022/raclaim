/* eslint-disable no-param-reassign */
/* eslint-disable no-restricted-syntax */
const Constant = require("./constants.cjs");

exports.keepLoop = (data) => {
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < data.length; i++) {
    const code = data[i].charCodeAt(0);
    if (code !== 32) {
      return data.substring(i, data.length);
    }
  }
  return data;
};
exports.getEobCode = (data) => {
  const i = data.indexOf("EOB CODE DESCRIPTIONS");
  const leftData = data.substring(i, data.length);
  let xLeft = leftData.indexOf("1REPORT:");
  if (xLeft === -1) {
    xLeft = leftData.indexOf("REPORT:");
  }
  let report = data.substring(i + 21, i + 21 + xLeft);
  const i2 = report.indexOf("EOB CODE");
  let xLeft2 = leftData.indexOf("1REPORT:");
  if (xLeft2 === -1) {
    xLeft2 = leftData.indexOf("REPORT:");
  }
  report = report.substring(i2, xLeft2);
  /*
   for (let x = 0; x < report.length; x++) {
     console.log('[x]', x, report[x], report[x].charCodeAt(0));
   }
   */
  const code = { pos: 64, len: 12, nxt: 93 };
  const desc = { pos: 76, len: 77, nxt: 93 };
  let currentLength = 128;
  const memArray = [];
  while (report.length > currentLength) {
    memArray.push(report.substring(code.pos, desc.pos + desc.len));
    code.pos += code.nxt;
    desc.pos += desc.nxt;

    currentLength += 140;
  }
  // console.log('report',report);
};
exports.getMedicaidMemberDenied = (data) => {
  const i = data.indexOf("PROFESSIONAL SERVICES CLAIMS DENIED");
  const leftData = data.substring(i, data.length);
  const xLeft = leftData.indexOf("TOTAL PROFESSIONAL SERVICE CLAIMS DENIED:");
  // start from Member Name
  let service; // 96
  let modifierCd;
  let srvDateFrom;
  let srvDateTo;
  let detail;
  let billedAmt;
  let currentLength;
  let report = data.substring(i, i + xLeft);
  const memberNbr = report.indexOf("--ICN--");
  report = report.substring(memberNbr, xLeft);

  const memberData = report.split("--ICN--");

  const serviceInfo = [];
  for (const w of memberData) {
    if (w.trim().length > 0) {
      const memberStart = w.substring(
        w.indexOf("MEMBER NAME: ") + 13,
        w.length
      );
      const nameInfo = memberStart.substring(0, 30);
      let procCd = memberStart.substring(
        memberStart.indexOf("PROC CD"),
        memberStart.length
      );
      const isProcCdSplit =
        memberStart.indexOf("PROC CD") !== memberStart.lastIndexOf("PROC CD");

      let iReport = procCd.indexOf("1REPORT:");
      if (iReport === -1) {
        iReport = procCd.indexOf("REPORT:");
      }

      if (iReport !== -1) {
        procCd = procCd.substring(0, iReport);
      }
      const f = procCd.replace(/\\n/g, "");
      service = { pos: 96, len: 9, nxt: 268 }; // 96
      modifierCd = { pos: 103, len: 4, nxt: 268 }; // 103
      srvDateFrom = { pos: 128, len: 7, nxt: 268 }; // 128
      srvDateTo = { pos: 135, len: 7, nxt: 268 }; // 135
      detail = { pos: 178, len: 14, nxt: 268 }; // 178
      billedAmt = { pos: 299, len: 60, nxt: 268 }; // 299
      currentLength = 359;
      let cnt = 1;
      while (f.length > currentLength) {
        const srvCode = f.substring(service.pos, service.pos + srvDateFrom.len);
        const modifier = f.substring(
          modifierCd.pos,
          modifierCd.pos + modifierCd.len
        );
        const srvFrom = f.substring(
          srvDateFrom.pos,
          srvDateFrom.pos + srvDateFrom.len
        );
        const srvTo = f.substring(srvDateTo.pos, srvDateTo.pos + srvDateTo.len);
        const srvDetail = f.substring(detail.pos, detail.pos + detail.len);
        const srvBilled = f.substring(
          billedAmt.pos,
          billedAmt.pos + billedAmt.len
        );
        const srvDetailArray = srvDetail ? srvDetail.toString().split(" ") : [];
        const svInfo = [];
        if (srvDetailArray && srvDetailArray.length) {
          for (const sv of srvDetailArray) {
            const d = Constant.EOB_CODES.filter((f1) => f1.code === sv);
            if (d && d.length) {
              svInfo.push(`(${d[0].code}) ${d[0].desc}`);
            }
          }
        }
        const srvcDesc = Constant.SERVICE_CODES.filter(
          (s) => s.code === srvCode.replace(/^\s+|\s+$/g, "")
        );
        serviceInfo.push({
          name: cnt === 1 ? nameInfo : "-- same --",
          samename: nameInfo,
          srvcCode: srvCode.trim(),
          srvcDesc: srvcDesc && srvcDesc.length ? srvcDesc[0].desc : "",
          srvcFrom: srvFrom.replace(/ /g, ""),
          srvcTo: srvTo.replace(/ /g, ""),
          srvcDetail: srvDetail,
          srvcBilledAmt: srvBilled.replace(/ /g, ""),
          svDescription: svInfo,
          srvcModifierCd: modifier.trim(),
        });
        cnt += 1;
        currentLength = billedAmt.pos + billedAmt.nxt;
        service.pos += service.nxt;
        srvDateFrom.pos += srvDateFrom.nxt;
        srvDateTo.pos += srvDateTo.nxt;
        detail.pos += detail.nxt;
        modifierCd.pos += modifierCd.nxt;
        billedAmt.pos += billedAmt.nxt;
      }

      if (isProcCdSplit) {
        service = { pos: 96, len: 9, nxt: 268 }; // 96
        modifierCd = { pos: 103, len: 4, nxt: 268 }; // 103
        srvDateFrom = { pos: 128, len: 7, nxt: 268 }; // 128
        srvDateTo = { pos: 135, len: 7, nxt: 268 }; // 135
        detail = { pos: 178, len: 14, nxt: 268 }; // 178
        billedAmt = { pos: 299, len: 60, nxt: 268 }; // 299
        currentLength = 359;
        const lastProc = w.lastIndexOf("PROC CD");
        const rem = w.substring(lastProc, w.length);

        while (rem.length > currentLength) {
          const srvCode = rem.substring(
            service.pos,
            service.pos + srvDateFrom.len
          );
          const modifier = rem.substring(
            modifierCd.pos,
            modifierCd.pos + modifierCd.len
          );
          const srvFrom = rem.substring(
            srvDateFrom.pos,
            srvDateFrom.pos + srvDateFrom.len
          );
          const srvTo = rem.substring(
            srvDateTo.pos,
            srvDateTo.pos + srvDateTo.len
          );
          const srvDetail = rem.substring(detail.pos, detail.pos + detail.len);
          const srvBilled = rem.substring(
            billedAmt.pos,
            billedAmt.pos + billedAmt.len
          );
          const srvDetailArray = srvDetail
            ? srvDetail.toString().split(" ")
            : [];
          const svInfo = [];
          if (srvDetailArray && srvDetailArray.length) {
            // eslint-disable-next-line no-restricted-syntax
            for (const sv of srvDetailArray) {
              const d = Constant.EOB_CODES.filter((f2) => f2.code === sv);
              if (d && d.length) {
                svInfo.push(`(${d[0].code}) ${d[0].desc}`);
              }
            }
          }
          const srvcDesc = Constant.SERVICE_CODES.filter(
            (s) => s.code === srvCode.replace(/^\s+|\s+$/g, "")
          );
          serviceInfo.push({
            name: cnt === 1 ? nameInfo : "-- same --",
            samename: nameInfo,
            srvcCode: srvCode.trim(),
            srvcDesc: srvcDesc && srvcDesc.length ? srvcDesc[0].desc : "",
            srvcFrom: srvFrom.replace(/ /g, ""),
            srvcTo: srvTo.replace(/ /g, ""),
            srvcDetail: srvDetail,
            srvcBilledAmt: srvBilled.replace(/ /g, ""),
            svDescription: svInfo,
            srvcModifierCd: modifier.trim(),
          });
          cnt += 1;
          currentLength = billedAmt.pos + billedAmt.nxt;
          service.pos += service.nxt;
          srvDateFrom.pos += srvDateFrom.nxt;
          srvDateTo.pos += srvDateTo.nxt;
          detail.pos += detail.nxt;
          modifierCd.pos += modifierCd.nxt;
          billedAmt.pos += billedAmt.nxt;
        }
      }
    }
  }
  return serviceInfo;
};

exports.getAdjustment = (data) => {
  const i = data.indexOf("PROFESSIONAL SERVICES CLAIM ADJUSTMENTS");
  const serviceInfo = [];
  if (i !== -1) {
    const leftData = data.substring(i, data.length);
    const xLeft = leftData.indexOf("TOTAL NO. ADJ:");
    // start from Member Name

    let report = data.substring(i, i + xLeft);
    const memberNbr = report.indexOf("--ICN--");
    report = report.substring(memberNbr, xLeft);

    const memberData = report.split("--ICN--");

    for (const w of memberData) {
      if (w.trim().length > 0) {
        const memberStart = w.substring(
          w.indexOf("MEMBER NAME: ") + 13,
          w.length
        );
        const nameInfo = memberStart.substring(0, 30);
        let procCd = memberStart.substring(
          memberStart.indexOf("PROC CD"),
          memberStart.length
        );
        const isProcCdSplit =
          memberStart.indexOf("PROC CD") !== memberStart.lastIndexOf("PROC CD");

        let iReport = procCd.indexOf("1REPORT:");
        if (iReport === -1) {
          iReport = procCd.indexOf("REPORT:");
        }

        if (iReport !== -1) {
          procCd = procCd.substring(0, iReport);
        }
        const f = procCd.replace(/\\n/g, "");
        console.log("[*** f ***[", f);
        /*
      if(nameInfo.indexOf('ELIZABETH CALLAHAN') !== -1) {
        for(let ii = 0;ii < f.length; ii++) {
          console.log('[ii]',ii,f[ii],f[ii].charCodeAt(0));
        }
      }
      */
        let service = { pos: 98, len: 7, nxt: 272 }; // 96
        let modifierCd = { pos: 105, len: 13, nxt: 272 }; // 103
        let srvDateFrom = { pos: 118, len: 7, nxt: 272 }; // 128
        let srvDateTo = { pos: 125, len: 7, nxt: 272 }; // 135
        let detail = ""; // { pos: 178, len: 14, nxt: 272 };//178
        let billedAmt = { pos: 285, len: 13, nxt: 272 }; // 299
        let paidAmt = { pos: 298, len: 13, nxt: 272 }; // 299
        let currentLength = 312;
        let cnt = 1;
        let additionalPayment = "";

        while (f.length > currentLength) {
          console.log("me", f);
          const addPaymentIndex = f.indexOf("ADDITIONAL PAYMENT");
          if (addPaymentIndex !== -1) {
            console.log("[Found Your]", addPaymentIndex);
            const line = f.substring(
              parseInt(addPaymentIndex, 10) + 25,
              f.length
            );
            console.log("[Line]", line);
            additionalPayment = line
              .substring(0, line.indexOf("-"))
              .replace(/\s/g, "");

            console.log("[Additional 1]", additionalPayment);
          }

          const srvCode = f.substring(
            service.pos,
            service.pos + srvDateFrom.len
          );
          const modifier = f.substring(
            modifierCd.pos,
            modifierCd.pos + modifierCd.len
          );
          const srvFrom = f.substring(
            srvDateFrom.pos,
            srvDateFrom.pos + srvDateFrom.len
          );
          const srvTo = f.substring(
            srvDateTo.pos,
            srvDateTo.pos + srvDateTo.len
          );
          const srvDetail = "";
          const srvBilled = f.substring(
            billedAmt.pos,
            billedAmt.pos + billedAmt.len
          );
          const srvPaid = f.substring(paidAmt.pos, paidAmt.pos + paidAmt.len);
          const srvDetailArray = srvDetail
            ? srvDetail.toString().split(" ")
            : [];
          const svInfo = [];
          if (srvDetailArray && srvDetailArray.length) {
            for (const sv of srvDetailArray) {
              const d = Constant.EOB_CODES.filter((f3) => f3.code === sv);
              if (d && d.length) {
                svInfo.push(`(${d[0].code}) ${d[0].desc}`);
              }
            }
          }
          const srvcDesc = Constant.SERVICE_CODES.filter(
            (s) => s.code === srvCode.replace(/^\s+|\s+$/g, "")
          );
          if (modifier.toString().trim() !== "TOTAL PROF") {
            serviceInfo.push({
              name: cnt === 1 ? nameInfo : "-- same --",
              samename: nameInfo,
              srvcCode: srvCode.trim(),
              srvcDesc: srvcDesc && srvcDesc.length ? srvcDesc[0].desc : "",
              srvcFrom: srvFrom.replace(/ /g, ""),
              srvcTo: srvTo.replace(/ /g, ""),
              srvcDetail: srvDetail,
              srvcBilledAmt: srvBilled.replace(/ /g, ""),
              srvcPaidAmt: srvPaid.replace(/ /g, ""),
              svDescription: svInfo,
              srvcModifierCd: modifier.trim(),
              additionalPayment,
            });
          }
          cnt += 1;
          currentLength = paidAmt.pos + paidAmt.nxt;
          service.pos += service.nxt;
          srvDateFrom.pos += srvDateFrom.nxt;
          srvDateTo.pos += srvDateTo.nxt;
          detail.pos += detail.nxt;
          modifierCd.pos += modifierCd.nxt;
          billedAmt.pos += billedAmt.nxt;
          paidAmt.pos += paidAmt.nxt;
        }

        if (isProcCdSplit) {
          service = { pos: 98, len: 7, nxt: 272 }; // 96
          modifierCd = { pos: 105, len: 13, nxt: 272 }; // 103
          srvDateFrom = { pos: 118, len: 7, nxt: 272 }; // 128
          srvDateTo = { pos: 125, len: 7, nxt: 272 }; // 135
          detail = ""; // { pos: 178, len: 14, nxt: 272 };//178
          billedAmt = { pos: 285, len: 13, nxt: 272 }; // 299
          paidAmt = { pos: 298, len: 13, nxt: 272 }; // 299
          currentLength = 312;
          const lastProc = w.lastIndexOf("PROC CD");
          const rem = w.substring(lastProc, w.length);
          additionalPayment = "";
          while (rem.length > currentLength) {
            console.log("[rem]", rem);
            const addPaymentIndex = rem.indexOf("ADDITIONAL PAYMENT");
            if (addPaymentIndex !== -1) {
              console.log("[Found Your rem]", addPaymentIndex);
              const line = rem.substring(
                parseInt(addPaymentIndex, 10) + 25,
                rem.length
              );
              console.log("[Line Ren∂]", line);
              additionalPayment = line
                .substring(0, line.indexOf("-"))
                .replace(/\s/g, "");
              console.log("[Additional Rem]", additionalPayment);
            }
            const srvCode = rem.substring(
              service.pos,
              service.pos + srvDateFrom.len
            );

            const modifier = rem.substring(
              modifierCd.pos,
              modifierCd.pos + modifierCd.len
            );
            const srvFrom = rem.substring(
              srvDateFrom.pos,
              srvDateFrom.pos + srvDateFrom.len
            );
            const srvTo = rem.substring(
              srvDateTo.pos,
              srvDateTo.pos + srvDateTo.len
            );
            const srvDetail = "";
            const srvBilled = rem.substring(
              billedAmt.pos,
              billedAmt.pos + billedAmt.len
            );
            const srvPaid = rem.substring(
              paidAmt.pos,
              paidAmt.pos + paidAmt.len
            );
            const srvDetailArray = srvDetail
              ? srvDetail.toString().split(" ")
              : [];
            const svInfo = [];
            if (srvDetailArray && srvDetailArray.length) {
              for (const sv of srvDetailArray) {
                const d = Constant.EOB_CODES.filter((f4) => f4.code === sv);
                if (d && d.length) {
                  svInfo.push(`(${d[0].code}) ${d[0].desc}`);
                }
              }
            }
            const srvcDesc = Constant.SERVICE_CODES.filter(
              (s) => s.code === srvCode.replace(/^\s+|\s+$/g, "")
            );

            serviceInfo.push({
              name: cnt === 1 ? nameInfo : "-- same --",
              samename: nameInfo,
              srvcCode: srvCode.trim(),
              srvcDesc: srvcDesc && srvcDesc.length ? srvcDesc[0].desc : "",
              srvcFrom: srvFrom.replace(/ /g, ""),
              srvcTo: srvTo.replace(/ /g, ""),
              srvcDetail: srvDetail,
              srvcBilledAmt: srvBilled.replace(/ /g, ""),
              srvcPaidAmt: srvPaid.replace(/ /g, ""),
              svDescription: svInfo,
              srvcModifierCd: modifier.trim(),
              additionalPayment,
            });

            cnt += 1;
            currentLength = paidAmt.pos + paidAmt.nxt;
            service.pos += service.nxt;
            srvDateFrom.pos += srvDateFrom.nxt;
            srvDateTo.pos += srvDateTo.nxt;
            detail.pos += detail.nxt;
            modifierCd.pos += modifierCd.nxt;
            billedAmt.pos += billedAmt.nxt;
            paidAmt.pos += paidAmt.nxt;
          }
        }
      }
    }
  }
  return serviceInfo;
};

exports.getMedicaidMemberPaid = (data) => {
  const i = data.indexOf("PROFESSIONAL SERVICES CLAIMS PAID");
  const leftData = data.substring(i, data.length);
  const xLeft = leftData.indexOf("TOTAL PROFESSIONAL SERVICE CLAIMS PAID:");
  // start from Member Name

  let report = data.substring(i, i + xLeft);
  const memberNbr = report.indexOf("--ICN--");
  report = report.substring(memberNbr, xLeft);

  const memberData = report.split("--ICN--");

  const serviceInfo = [];
  for (const w of memberData) {
    if (w.trim().length > 0) {
      const memberStart = w.substring(
        w.indexOf("MEMBER NAME: ") + 13,
        w.length
      );
      const nameInfo = memberStart.substring(0, 30);
      let procCd = memberStart.substring(
        memberStart.indexOf("PROC CD"),
        memberStart.length
      );
      const isProcCdSplit =
        memberStart.indexOf("PROC CD") !== memberStart.lastIndexOf("PROC CD");

      let iReport = procCd.indexOf("1REPORT:");
      if (iReport === -1) {
        iReport = procCd.indexOf("REPORT:");
      }

      if (iReport !== -1) {
        procCd = procCd.substring(0, iReport);
      }
      const f = procCd.replace(/\\n/g, "");
      /*
      if(nameInfo.indexOf('ELIZABETH CALLAHAN') !== -1) {
        for(let ii = 0;ii < f.length; ii++) {
          console.log('[ii]',ii,f[ii],f[ii].charCodeAt(0));
        }
      }
      */
      let service = { pos: 98, len: 7, nxt: 272 }; // 96
      let modifierCd = { pos: 105, len: 13, nxt: 272 }; // 103
      let srvDateFrom = { pos: 118, len: 7, nxt: 272 }; // 128
      let srvDateTo = { pos: 125, len: 7, nxt: 272 }; // 135
      let detail = { pos: 180, len: 14, nxt: 272 }; // 178
      let billedAmt = { pos: 285, len: 13, nxt: 272 }; // 299
      let paidAmt = { pos: 298, len: 13, nxt: 272 }; // 299
      let currentLength = 312;
      let cnt = 1;
      while (f.length > currentLength) {
        const srvCode = f.substring(service.pos, service.pos + srvDateFrom.len);
        const modifier = f.substring(
          modifierCd.pos,
          modifierCd.pos + modifierCd.len
        );
        const srvFrom = f.substring(
          srvDateFrom.pos,
          srvDateFrom.pos + srvDateFrom.len
        );
        const srvTo = f.substring(srvDateTo.pos, srvDateTo.pos + srvDateTo.len);
        const srvDetail = f.substring(detail.pos, detail.pos + detail.len);

        const srvBilled = f.substring(
          billedAmt.pos,
          billedAmt.pos + billedAmt.len
        );
        const srvPaid = f.substring(paidAmt.pos, paidAmt.pos + paidAmt.len);
        const srvDetailArray = srvDetail ? srvDetail.toString().split(" ") : [];
        const svInfo = [];
        if (srvDetailArray && srvDetailArray.length) {
          for (const sv of srvDetailArray) {
            const d = Constant.EOB_CODES.filter((f6) => f6.code === sv);
            if (d && d.length) {
              svInfo.push(`(${d[0].code}) ${d[0].desc}`);
            }
          }
        }
        const srvcDesc = Constant.SERVICE_CODES.filter(
          (s) => s.code === srvCode.replace(/^\s+|\s+$/g, "")
        );
        serviceInfo.push({
          name: cnt === 1 ? nameInfo : "-- same --",
          samename: nameInfo,
          srvcCode: srvCode.trim(),
          srvcDesc: srvcDesc && srvcDesc.length ? srvcDesc[0].desc : "",
          srvcFrom: srvFrom.replace(/ /g, ""),
          srvcTo: srvTo.replace(/ /g, ""),
          srvcDetail: srvDetail,
          srvcBilledAmt: srvBilled.replace(/ /g, ""),
          srvcPaidAmt: srvPaid.replace(/ /g, ""),
          svDescription: svInfo,
          srvcModifierCd: modifier.trim(),
        });

        cnt += 1;
        currentLength = paidAmt.pos + paidAmt.nxt;
        service.pos += service.nxt;
        srvDateFrom.pos += srvDateFrom.nxt;
        srvDateTo.pos += srvDateTo.nxt;
        detail.pos += detail.nxt;
        modifierCd.pos += modifierCd.nxt;
        billedAmt.pos += billedAmt.nxt;
        paidAmt.pos += paidAmt.nxt;
      }

      if (isProcCdSplit) {
        service = { pos: 98, len: 7, nxt: 272 }; // 96
        modifierCd = { pos: 105, len: 13, nxt: 272 }; // 103
        srvDateFrom = { pos: 118, len: 7, nxt: 272 }; // 128
        srvDateTo = { pos: 125, len: 7, nxt: 272 }; // 135
        detail = { pos: 180, len: 14, nxt: 272 }; // 178
        billedAmt = { pos: 285, len: 13, nxt: 272 }; // 299
        paidAmt = { pos: 298, len: 13, nxt: 272 }; // 299
        currentLength = 312;
        const lastProc = w.lastIndexOf("PROC CD");
        const rem = w.substring(lastProc, w.length);

        while (rem.length > currentLength) {
          const srvCode = rem.substring(
            service.pos,
            service.pos + srvDateFrom.len
          );

          const modifier = rem.substring(
            modifierCd.pos,
            modifierCd.pos + modifierCd.len
          );
          const srvFrom = rem.substring(
            srvDateFrom.pos,
            srvDateFrom.pos + srvDateFrom.len
          );
          const srvTo = rem.substring(
            srvDateTo.pos,
            srvDateTo.pos + srvDateTo.len
          );
          const srvDetail = rem.substring(detail.pos, detail.pos + detail.len);
          const srvBilled = rem.substring(
            billedAmt.pos,
            billedAmt.pos + billedAmt.len
          );
          const srvPaid = rem.substring(paidAmt.pos, paidAmt.pos + paidAmt.len);
          const srvDetailArray = srvDetail
            ? srvDetail.toString().split(" ")
            : [];
          const svInfo = [];
          if (srvDetailArray && srvDetailArray.length) {
            for (const sv of srvDetailArray) {
              const d = Constant.EOB_CODES.filter((f7) => f7.code === sv);
              if (d && d.length) {
                svInfo.push(`(${d[0].code}) ${d[0].desc}`);
              }
            }
          }
          const srvcDesc = Constant.SERVICE_CODES.filter(
            (s) => s.code === srvCode.replace(/^\s+|\s+$/g, "")
          );
          serviceInfo.push({
            name: cnt === 1 ? nameInfo : "-- same --",
            samename: nameInfo,
            srvcCode: srvCode.trim(),
            srvcDesc: srvcDesc && srvcDesc.length ? srvcDesc[0].desc : "",
            srvcFrom: srvFrom.replace(/ /g, ""),
            srvcTo: srvTo.replace(/ /g, ""),
            srvcDetail: srvDetail,
            srvcBilledAmt: srvBilled.replace(/ /g, ""),
            srvcPaidAmt: srvPaid.replace(/ /g, ""),
            svDescription: svInfo,
            srvcModifierCd: modifier.trim(),
          });

          cnt += 1;
          currentLength = paidAmt.pos + paidAmt.nxt;
          service.pos += service.nxt;
          srvDateFrom.pos += srvDateFrom.nxt;
          srvDateTo.pos += srvDateTo.nxt;
          detail.pos += detail.nxt;
          modifierCd.pos += modifierCd.nxt;
          billedAmt.pos += billedAmt.nxt;
          paidAmt.pos += paidAmt.nxt;
        }
      }
    }
  }
  return serviceInfo;
};
exports.getRemittanceSummary = (data) => {
  const i = data.indexOf("CRA-SUMM-R");
  const leftData = data.substring(i, data.length);
  const xLeft = leftData.indexOf("THIS AMOUNT REPRESENTS THE BILLED AMOUNT");
  // start from Member Name

  const report = data.substring(i, i + xLeft);
  console.log("[REPORT]", report);
  // claim paid
  const claimsPaidReportI = report.indexOf("CLAIMS PAID");
  const claimsCurrentNumber = report
    .substring(claimsPaidReportI + 21, claimsPaidReportI + 45)
    .replace(/ /g, "");
  const claimsCurrentAmount = report
    .substring(claimsPaidReportI + 50, claimsPaidReportI + 65)
    .replace(/ /g, "");
  // adjustment
  const claimAdjustmentI = report.indexOf("CLAIM ADJUSTMENTS");
  const claimsAdjustmentsNumber = report
    .substring(claimAdjustmentI + 21, claimAdjustmentI + 45)
    .replace(/ /g, "");
  const claimAdjustmentsAmount = report
    .substring(claimAdjustmentI + 50, claimAdjustmentI + 65)
    .replace(/ /g, "");

  // total claims payments
  const totalClaimsPaymentI = report.indexOf("TOTAL CLAIMS PAYMENTS");
  const totalClaimsPaymentNumber = report
    .substring(totalClaimsPaymentI + 21, totalClaimsPaymentI + 45)
    .replace(/ /g, "");
  const totalClaimsPaymentAmount = report
    .substring(totalClaimsPaymentI + 50, totalClaimsPaymentI + 65)
    .replace(/ /g, "");
  // claims denied
  const totalClaimsDeniedI = report.indexOf("CLAIMS DENIED");
  const totalClaimsDeniedNumber = report
    .substring(totalClaimsDeniedI + 21, totalClaimsDeniedI + 45)
    .replace(/ /g, "");
  const totalClaimsDeniedAmount = report
    .substring(totalClaimsDeniedI + 50, totalClaimsDeniedI + 65)
    .replace(/ /g, "");
  // Claims payments
  const totalPaymentsI = report.indexOf("PAYMENTS:");
  const totalClaimAdjPaymentI = report.indexOf("CLAIM ADJUSTMENT PAYOUT");
  const claimsPaymentData = report.substring(
    totalPaymentsI,
    totalClaimAdjPaymentI
  );

  const totalClaimsPaymentsI = claimsPaymentData.indexOf("CLAIMS PAYMENTS");
  const totalClaimsPaymentsAmount = claimsPaymentData
    .substring(totalClaimsPaymentsI + 50, totalClaimsPaymentsI + 65)
    .replace(/ /g, "");
  console.log("[]", totalClaimsPaymentsI);
  // Claim adjustment payout
  // const totalClaimAdjPaymentI = report.indexOf("CLAIM ADJUSTMENT PAYOUT");
  const totalClaimsAdjPaymentsAmount = report
    .substring(totalClaimAdjPaymentI + 50, totalClaimAdjPaymentI + 65)
    .replace(/ /g, "");
  // Claim adjustment payout
  const totalClaimAdjFromCurrentCyclePaymentI = report.indexOf(
    "ADJUSTMENTS FROM CURRENT CYCLE"
  );
  const totalClaimAdjFromCurrentCyclePaymentAmount = report
    .substring(
      totalClaimAdjFromCurrentCyclePaymentI + 40,
      totalClaimAdjFromCurrentCyclePaymentI + 65
    )
    .replace(/ /g, "");
  const totalClaimAdjFromPreviousCyclePaymentI = report.indexOf(
    "OUTSTANDING FROM PREVIOUS CYCLES"
  );
  const totalClaimAdjFromPreviousCyclePaymentAmount = report
    .substring(
      totalClaimAdjFromPreviousCyclePaymentI + 40,
      totalClaimAdjFromPreviousCyclePaymentI + 65
    )
    .replace(/ /g, "");

  // net earnings
  const netEarningI = report.indexOf("NET EARNINGS");
  const netEarningsAmount = report
    .substring(netEarningI + 40, netEarningI + 65)
    .replace(/ /g, "");

  const remittancePaidI = report.indexOf("DATE:");
  const remittanceDate = report.substring(
    remittancePaidI + 7,
    remittancePaidI + 17
  );
  const remittanceEftI = report.indexOf("CHECK/EFT NUMBER");
  const remittanceEftNumber = report
    .substring(remittanceEftI + 16, remittanceEftI + 30)
    .replace(/ /g, "");
  const remittanceEftDateI = report.indexOf("PAYMENT DATE");
  const remittanceEftDate = report
    .substring(remittanceEftDateI + 16, remittanceEftDateI + 30)
    .replace(/ /g, "");
  return {
    claimsCurrentNumber,
    claimsCurrentAmount,
    claimsAdjustmentsNumber,
    claimAdjustmentsAmount,
    totalClaimsPaymentNumber,
    totalClaimsPaymentAmount,
    totalClaimsDeniedNumber,
    totalClaimsDeniedAmount: totalClaimsDeniedAmount || 0.0,
    totalClaimsPaymentsAmount,
    totalClaimsAdjPaymentsAmount,
    totalClaimAdjFromCurrentCyclePaymentAmount,
    totalClaimAdjFromPreviousCyclePaymentAmount,
    netEarningsAmount,
    remittanceDate,
    remittanceEftNumber,
    remittanceEftDate,
  };
};
exports.formatMedicareDateOfService = (data, fmt) => {
  if (fmt === "from") {
    const temp = data.replace(/ /g, "");
    return temp.substring(0, 4) + temp.substring(8, 10);
  }
  const temp = data.replace(/ /g, "");
  return temp.substring(4, temp.length);
};
exports.getMedicarePayments = (data) => {
  const serviceMap = new Map();
  const i = data.indexOf("PERF PROV");
  const xLeft = data.indexOf("GLOSSARY");
  console.log("[Start/End]", i, xLeft);
  let summaryData = data.substring(i, xLeft);
  console.log(
    "[CAN I SEE CLIAM INFORMATION",
    summaryData.indexOf("CLAIM INFORMATION")
  );
  // console.log('[summary data],',summaryData.length);
  // console.log('preview summary data]', summaryData);

  const nameArray = [];
  let summaryDataInfoTxt =
    summaryData.indexOf("CLAIM INFORMATION") !== -1
      ? "CLAIM INFORMATION"
      : "______";
  while (
    summaryData.indexOf("NAME") !== -1 &&
    summaryData.indexOf(summaryDataInfoTxt) !== -1
  ) {
    const iName = summaryData.indexOf("NAME");
    const iClaim = summaryData.indexOf(summaryDataInfoTxt);
    console.log("[iName/iClaim]", iName, iClaim);
    console.log("[summary Data]", summaryData.length);
    nameArray.push(summaryData.substring(iName, iClaim + 1));

    summaryData = summaryData.substring(iClaim + 115, summaryData.length);

    summaryDataInfoTxt =
      summaryData.indexOf("CLAIM INFORMATION") !== -1
        ? "CLAIM INFORMATION"
        : "______";
  }
  const finalData = [];
  nameArray.forEach((n) => {
    if (n.indexOf("NAME") !== -1) {
      //  console.log('[ *** name ***]', index, n);
      //  console.log('[substrin]',n.substring(262,265));
      console.log("[name]", n);

      let patientName = "";

      let serviceFrom = "";
      let serviceTo = "";
      let dateOfService = "";
      let serviceCode = "";
      let modifier = "";
      let amtBilled;
      let amtAllowed;
      let amtDeduct;
      let coinsurance;
      let grp;
      let net;
      let rem;
      let remDesc = "";

      if (n.substring(393, 396).indexOf("REM") !== -1) {
        console.log("[found me]", n);
        patientName = n.substring(5, 30).trim();
        serviceFrom = this.formatMedicareDateOfService(
          n.substring(273, 284),
          "from"
        );
        serviceTo = this.formatMedicareDateOfService(
          n.substring(273, 284),
          "to"
        );

        dateOfService = n.substring(273, 284).replace(/ /g, "");
        serviceCode = n.substring(295, 300).replace(/ /g, "");
        modifier = n.substring(301, 305).replace(/ /g, "");
        amtBilled = n.substring(312, 320).replace(/ /g, "");
        amtAllowed = n.substring(321, 331).replace(/ /g, "");
        amtDeduct = n.substring(332, 339).replace(/ /g, "");
        coinsurance = n.substring(340, 348).replace(/ /g, "");
        grp = n.substring(349, 364).replace(/ /g, "");
        net = n.substring(365, 375).replace(/ /g, "");
        rem = n.substring(397, 402).replace(/ /g, "");
        remDesc = Constant.REM_GLOSSARY.find(
          (c) => c.code === n.substring(397, 402).replace(/ /g, "")
        )
          ? Constant.REM_GLOSSARY.find(
              (c) => c.code === n.substring(397, 402).replace(/ /g, "")
            ).desc
          : "";
      } else if (n.substring(262, 265).indexOf("REM") === -1) {
        //  finalData.push({
        console.log("[found me2]", n);

        patientName = n.substring(5, 30).trim();
        serviceFrom = this.formatMedicareDateOfService(
          n.substring(142, 153),
          "from"
        );
        serviceTo = this.formatMedicareDateOfService(
          n.substring(142, 153),
          "to"
        );

        dateOfService = n.substring(142, 153).replace(/ /g, "");
        serviceCode = n.substring(164, 169).replace(/ /g, "");
        modifier = n.substring(170, 174).replace(/ /g, "");
        amtBilled = n.substring(308, 320).replace(/ /g, "");
        amtAllowed = n.substring(321, 331).replace(/ /g, "");
        amtDeduct = n.substring(332, 339).replace(/ /g, "");
        coinsurance = n.substring(340, 348).replace(/ /g, "");
        grp = n.substring(349, 364).replace(/ /g, "");
        net = n.substring(365, 375).replace(/ /g, "");
        rem = "";
        // });
        /*
        console.log('FOUND ME',n.substring(5, 30));
        console.log('[NAME]', n.substring(5, 30));
        console.log('[Date Service]', n.substring(142, 153));
        console.log('[SERVICE]', n.substring(164, 169));
        console.log('[MODIFIER]', n.substring(170, 174));
        console.log('[BILLED]', n.substring(308, 320));
        console.log('[ALLOWED]', n.substring(321, 331));
        console.log('[DEDUCT]', n.substring(332, 339));
        console.log('[COINS]', n.substring(340, 348));
        console.log('[GRP/RC-AMT]', n.substring(349, 364));
        console.log('[NET]', n.substring(365, 375));
        console.log('[REM]','');
        */
      } else {
        patientName = n.substring(5, 30).trim();
        serviceFrom = this.formatMedicareDateOfService(
          n.substring(142, 153),
          "from"
        );
        serviceTo = this.formatMedicareDateOfService(
          n.substring(142, 153),
          "to"
        );
        dateOfService = n.substring(142, 153).replace(/ /g, "");
        serviceCode = n.substring(164, 169).replace(/ /g, "");
        modifier = n.substring(170, 174).replace(/ /g, "");
        amtBilled = n.substring(438, 451).replace(/ /g, "");
        amtAllowed = n.substring(451, 462).replace(/ /g, "");
        amtDeduct = n.substring(462, 470).replace(/ /g, "");
        coinsurance = n.substring(470, 479).replace(/ /g, "");
        grp = n.substring(479, 495).replace(/ /g, "");
        net = n.substring(495, 506).replace(/ /g, "");
        rem = n.substring(266, 271).replace(/ /g, "");
        remDesc = Constant.REM_GLOSSARY.find(
          (c) => c.code === n.substring(266, 271).replace(/ /g, "")
        )
          ? Constant.REM_GLOSSARY.find(
              (c) => c.code === n.substring(266, 271).replace(/ /g, "")
            ).desc
          : "";
      }
      // });
      /*
      console.log('[NAME]', n.substring(5, 30));
      console.log('[Date Service]', n.substring(142, 153));
      console.log('[SERVICE]', n.substring(164, 169));
      console.log('[MODIFIER]', n.substring(170, 174));
      console.log('[REM]', n.substring(266, 271));
    
      console.log('[BILLED]', n.substring(438, 451));
      console.log('[ALLOWED]', n.substring(451, 462));
      console.log('[DEDUCT]', n.substring(462, 470));
      console.log('[COINS]', n.substring(470, 479));
      console.log('[GRP/RC-AMT]', n.substring(479, 495));
      console.log('[NET]', n.substring(495, 506));
*/

      finalData.push({
        patientName,
        serviceFrom,
        serviceTo,
        dateOfService,
        serviceCode,
        modifier,
        amtBilled: amtBilled ? 1 * amtBilled : 0,
        amtAllowed: amtAllowed ? 1 * amtAllowed : 0,
        amtDeduct: amtDeduct ? 1 * amtDeduct : 0,
        coinsurance: coinsurance ? 1 * coinsurance : 0,
        grp,
        net: net ? 1 * net : 0,
        rem,
        remDesc,
      });
      const tempService = `${serviceCode} ${modifier}`.trim();
      if (serviceMap.get(tempService)) {
        const cntService = serviceMap.get(tempService) || 0;
        serviceMap.set(tempService, cntService + 1);
      } else {
        serviceMap.set(tempService, 1);
      }
      // for (let x = 0; x < n.length; x++) {
      // console.log('[i/charcode]',x,n[x].charCodeAt(0),n[x]);
      // console.log('[NAME]',n.substring())
      //
      // }
    }
  });

  const payloadData = {
    details: finalData,
    services: serviceMap,
  };
  return payloadData;
};
exports.getMedicareTotalRemittance = (data) => {
  const i = data.indexOf("TOTALS:");
  const xLeft = data.indexOf("GLOSSARY");
  const summaryData = data.substring(i, xLeft);
  // console.log('[summary Data]',summaryData);
  // for (let x = 0; x < summaryData.length; x++) {
  // console.log('[i/charcode]',x,summaryData[x].charCodeAt(0),summaryData[x]);
  // }
  const numberOfClaims = summaryData.substring(271, 276).replace(/ /g, "");
  const billedAmt = summaryData.substring(277, 289).replace(/ /g, "");
  const allowedAmt = summaryData.substring(290, 302).replace(/ /g, "");
  const deductAmt = summaryData.substring(303, 312).replace(/ /g, "");
  const coinsAmt = summaryData.substring(313, 324).replace(/ /g, "");
  const totalRcAmt = summaryData.substring(325, 337).replace(/ /g, "");
  const procPdAmt = summaryData.substring(338, 350).replace(/ /g, "");
  const provAdjAmt = summaryData.substring(351, 363).replace(/ /g, "");
  const checkAmt = summaryData.substring(364, 376).replace(/ /g, "");
  console.log("number of Claims", numberOfClaims);
  console.log("Billed Amt", billedAmt);
  console.log("Allowed Amt", allowedAmt);
  console.log("Deduct Amt", deductAmt);
  console.log("Coins Amount", coinsAmt);
  console.log("[total Rcd Amt]", totalRcAmt);
  console.log("[proc Pd Amt]", procPdAmt);
  console.log("[prov Adj Amt]", provAdjAmt);
  console.log("[check amt]", checkAmt);

  const medicareSummary = {
    numberOfClaims: numberOfClaims ? 1 * numberOfClaims : 0,
    billedAmt: billedAmt ? 1 * billedAmt : 0,
    allowedAmt: allowedAmt ? 1 * allowedAmt : 0,
    deductAmt: deductAmt ? 1 * deductAmt : 0,
    coinsAmt: coinsAmt ? 1 * coinsAmt : 0,
    totalRcAmt: totalRcAmt ? 1 * totalRcAmt : 0,
    procPdAmt: procPdAmt ? 1 * procPdAmt : 0,
    provAdjAmt: provAdjAmt ? 1 * provAdjAmt : 0,
    checkAmt: checkAmt ? 1 * checkAmt : 0,
  };
  return medicareSummary;
};

exports.getMedicareMemberDenied = (data) => {
  const i = data.indexOf(
    "MEDICARE CROSSOVER PROFESSIONAL SERVICE CLAIMS DENIED"
  );
  const leftData = data.substring(i, data.length);
  const xLeft = leftData.indexOf(
    "TOTAL MEDICARE CROSSOVER PROFESSIONAL SERVICE CLAIMS DENIED:"
  );
  // start from Member Name

  let report = data.substring(i, i + xLeft);
  const memberNbr = report.indexOf("--ICN--");
  report = report.substring(memberNbr, xLeft);

  const memberData = report.split("--ICN--");

  const serviceInfo = [];
  for (const w of memberData) {
    if (w.trim().length > 0) {
      const memberStart = w.substring(
        w.indexOf("MEMBER NAME: ") + 13,
        w.length
      );
      const nameInfo = memberStart.substring(0, 30);
      // console.log('[name info[', nameInfo);
      const memberEnd = memberStart.substring(
        46,
        memberStart.indexOf("REV CD")
      );
      // console.log('member End', memberEnd);
      const consInsData = memberEnd.split(" ");
      const recMemberInit = [];
      for (const cn of consInsData) {
        if (cn.trim().length) {
          recMemberInit.push(cn);
        }
      }
      const coInsAmount = recMemberInit[14];

      let procCd = memberStart.substring(
        memberStart.indexOf("REV CD"),
        memberStart.length
      );
      const isProcCdSplit =
        memberStart.indexOf("REV CD") !== memberStart.lastIndexOf("REV CD");

      let iReport = procCd.indexOf("1REPORT:");
      if (iReport === -1) {
        iReport = procCd.indexOf("REPORT:");
      }
      if (iReport !== -1) {
        procCd = procCd.substring(0, iReport);
      }
      const f = procCd.replace(/\\n/g, "");

      let service = { pos: 106, len: 9, nxt: 273 }; // 96
      let modifierCd = { pos: 113, len: 4, nxt: 273 }; // 103
      let srvDateFrom = { pos: 127, len: 7, nxt: 273 }; // 128
      let srvDateTo = { pos: 134, len: 7, nxt: 273 }; // 135
      let detail = { pos: 184, len: 13, nxt: 273 }; // 178
      let billedAmt = { pos: 305, len: 60, nxt: 273 }; // 299
      let currentLength = 365;
      let cnt = 1;
      while (f.length > currentLength) {
        const srvCode = f.substring(service.pos, service.pos + srvDateFrom.len);
        const modifier = f.substring(
          modifierCd.pos,
          modifierCd.pos + modifierCd.len
        );
        const srvFrom = f.substring(
          srvDateFrom.pos,
          srvDateFrom.pos + srvDateFrom.len
        );
        const srvTo = f.substring(srvDateTo.pos, srvDateTo.pos + srvDateTo.len);
        const srvDetail = f.substring(detail.pos, detail.pos + detail.len);
        /*
        const srvBilled = f.substring(
          billedAmt.pos,
          billedAmt.pos + billedAmt.len
        );
        */
        const srvDetailArray = srvDetail ? srvDetail.toString().split(" ") : [];
        const svInfo = [];
        if (srvDetailArray && srvDetailArray.length) {
          for (const sv of srvDetailArray) {
            const d = Constant.EOB_CODES.filter((f10) => f10.code === sv);
            if (d && d.length) {
              svInfo.push(`(${d[0].code}) ${d[0].desc}`);
            }
          }
        }
        const srvcDesc = Constant.SERVICE_CODES.filter(
          (s) => s.code === srvCode.replace(/^\s+|\s+$/g, "")
        );
        serviceInfo.push({
          name: cnt === 1 ? nameInfo : "-- same --",
          samename: nameInfo,
          srvcCode: srvCode.trim(),
          srvcDesc: srvcDesc && srvcDesc.length ? srvcDesc[0].desc : "",
          srvcFrom: srvFrom.replace(/ /g, ""),
          srvcTo: srvTo.replace(/ /g, ""),
          srvcDetail: srvDetail,
          srvcBilledAmt: cnt === 1 ? coInsAmount : 0.0,
          svDescription: svInfo,
          srvcModifierCd: modifier.trim(),
        });
        cnt += 1;
        currentLength = billedAmt.pos + billedAmt.nxt;
        service.pos += service.nxt;
        srvDateFrom.pos += srvDateFrom.nxt;
        srvDateTo.pos += srvDateTo.nxt;
        detail.pos += detail.nxt;
        modifierCd.pos += modifierCd.nxt;
        billedAmt.pos += billedAmt.nxt;
      }
      if (isProcCdSplit) {
        service = { pos: 106, len: 9, nxt: 273 }; // 96
        modifierCd = { pos: 113, len: 4, nxt: 273 }; // 103
        srvDateFrom = { pos: 127, len: 7, nxt: 273 }; // 128
        srvDateTo = { pos: 134, len: 7, nxt: 273 }; // 135
        detail = { pos: 184, len: 13, nxt: 273 }; // 178
        billedAmt = { pos: 305, len: 60, nxt: 273 }; // 299
        currentLength = 365;

        const lastProc = w.lastIndexOf("REV CD");
        const rem = w.substring(lastProc, w.length);

        while (rem.length > currentLength) {
          const srvCode = rem.substring(
            service.pos,
            service.pos + srvDateFrom.len
          );
          const modifier = rem.substring(
            modifierCd.pos,
            modifierCd.pos + modifierCd.len
          );
          const srvFrom = rem.substring(
            srvDateFrom.pos,
            srvDateFrom.pos + srvDateFrom.len
          );
          const srvTo = rem.substring(
            srvDateTo.pos,
            srvDateTo.pos + srvDateTo.len
          );
          const srvDetail = rem.substring(detail.pos, detail.pos + detail.len);
          /*
          const srvBilled = rem.substring(
            billedAmt.pos,
            billedAmt.pos + billedAmt.len
          );
          */
          const srvDetailArray = srvDetail
            ? srvDetail.toString().split(" ")
            : [];
          const svInfo = [];
          if (srvDetailArray && srvDetailArray.length) {
            for (const sv of srvDetailArray) {
              const d = Constant.EOB_CODES.filter((f8) => f8.code === sv);
              if (d && d.length) {
                svInfo.push(`(${d[0].code}) ${d[0].desc}`);
              }
            }
          }
          const srvcDesc = Constant.SERVICE_CODES.filter(
            (s) => s.code === srvCode.replace(/^\s+|\s+$/g, "")
          );
          serviceInfo.push({
            name: cnt === 1 ? nameInfo : "-- same --",
            samename: nameInfo,
            srvcCode: srvCode.trim(),
            srvcDesc: srvcDesc && srvcDesc.length ? srvcDesc[0].desc : "",
            srvcFrom: srvFrom.replace(/ /g, ""),
            srvcTo: srvTo.replace(/ /g, ""),
            srvcDetail: srvDetail,
            srvcBilledAmt: cnt === 1 ? coInsAmount : 0.0,
            svDescription: svInfo,
            srvcModifierCd: modifier.trim(),
          });
          cnt += 1;
          currentLength = billedAmt.pos + billedAmt.nxt;
          service.pos += service.nxt;
          srvDateFrom.pos += srvDateFrom.nxt;
          srvDateTo.pos += srvDateTo.nxt;
          detail.pos += detail.nxt;
          modifierCd.pos += modifierCd.nxt;
          billedAmt.pos += billedAmt.nxt;
        }
      }
    }
  }
  return serviceInfo;
};

exports.getMedicareMemberPaid = (data) => {
  const i = data.indexOf("MEDICARE CROSSOVER PROFESSIONAL SERVICE CLAIMS PAID");
  const leftData = data.substring(i, data.length);
  const xLeft = leftData.indexOf(
    "TOTAL MEDICARE CROSSOVER PROFESSIONAL SERVICE CLAIMS PAID:"
  );
  // start from Member Name

  let report = data.substring(i, i + xLeft);
  const memberNbr = report.indexOf("--ICN--");
  report = report.substring(memberNbr, xLeft);

  const memberData = report.split("--ICN--");

  const serviceInfo = [];
  for (const w of memberData) {
    if (w.trim().length > 0) {
      const memberStart = w.substring(
        w.indexOf("MEMBER NAME: ") + 13,
        w.length
      );
      const nameInfo = memberStart.substring(0, 30);
      //  console.log('[name info[', nameInfo);
      const memberEnd = memberStart.substring(
        46,
        memberStart.indexOf("REV CD")
      );
      // console.log('member End', memberEnd);
      const consInsData = memberEnd.split(" ");
      const recMemberInit = [];
      for (const cn of consInsData) {
        if (cn.trim().length) {
          recMemberInit.push(cn);
        }
      }
      // const coInsAmount = recMemberInit[14];

      let procCd = memberStart.substring(
        memberStart.indexOf("REV CD"),
        memberStart.length
      );
      const isProcCdSplit =
        memberStart.indexOf("REV CD") !== memberStart.lastIndexOf("REV CD");

      let iReport = procCd.indexOf("1REPORT:");
      if (iReport === -1) {
        iReport = procCd.indexOf("REPORT:");
      }
      if (iReport !== -1) {
        procCd = procCd.substring(0, iReport);
      }
      const f = procCd.replace(/\\n/g, "");

      let service = { pos: 106, len: 9, nxt: 273 }; // 96
      let modifierCd = { pos: 113, len: 4, nxt: 273 }; // 103
      let srvDateFrom = { pos: 127, len: 7, nxt: 273 }; // 128
      let srvDateTo = { pos: 134, len: 7, nxt: 273 }; // 135
      let detail = { pos: 184, len: 13, nxt: 273 }; // 178
      let billedAmt = { pos: 285, len: 13, nxt: 273 }; // 299
      let paidAmt = { pos: 299, len: 13, nxt: 273 }; // 299
      let currentLength = 312;
      let cnt = 1;
      while (f.length > currentLength) {
        const srvCode = f.substring(service.pos, service.pos + srvDateFrom.len);
        const modifier = f.substring(
          modifierCd.pos,
          modifierCd.pos + modifierCd.len
        );
        const srvFrom = f.substring(
          srvDateFrom.pos,
          srvDateFrom.pos + srvDateFrom.len
        );
        const srvTo = f.substring(srvDateTo.pos, srvDateTo.pos + srvDateTo.len);
        const srvDetail = f.substring(detail.pos, detail.pos + detail.len);
        const srvPaidAmt = f.substring(paidAmt.pos, paidAmt.pos + paidAmt.len);

        const srvBilled = f.substring(
          billedAmt.pos,
          billedAmt.pos + billedAmt.len
        );
        const srvDetailArray = srvDetail ? srvDetail.toString().split(" ") : [];
        const svInfo = [];
        if (srvDetailArray && srvDetailArray.length) {
          for (const sv of srvDetailArray) {
            const d = Constant.EOB_CODES.filter((f11) => f11.code === sv);
            if (d && d.length) {
              svInfo.push(`(${d[0].code}) ${d[0].desc}`);
            }
          }
        }
        const srvcDesc = Constant.SERVICE_CODES.filter(
          (s) => s.code === srvCode.replace(/^\s+|\s+$/g, "")
        );
        serviceInfo.push({
          name: cnt === 1 ? nameInfo : "-- same --",
          samename: nameInfo,
          srvcCode: srvCode.trim(),
          srvcDesc: srvcDesc && srvcDesc.length ? srvcDesc[0].desc : "",
          srvcFrom: srvFrom.replace(/ /g, ""),
          srvcTo: srvTo.replace(/ /g, ""),
          srvcDetail: srvDetail,
          srvcBilledAmt: srvBilled,
          srvcPaidAmt: srvPaidAmt,
          svDescription: svInfo,
          srvcModifierCd: modifier.trim(),
        });
        cnt += 1;
        currentLength = paidAmt.pos + paidAmt.nxt;
        service.pos += service.nxt;
        srvDateFrom.pos += srvDateFrom.nxt;
        srvDateTo.pos += srvDateTo.nxt;
        detail.pos += detail.nxt;
        modifierCd.pos += modifierCd.nxt;
        billedAmt.pos += billedAmt.nxt;
        paidAmt.pos += paidAmt.nxt;
      }
      if (isProcCdSplit) {
        service = { pos: 106, len: 9, nxt: 273 }; // 96
        modifierCd = { pos: 113, len: 4, nxt: 273 }; // 103
        srvDateFrom = { pos: 127, len: 7, nxt: 273 }; // 128
        srvDateTo = { pos: 134, len: 7, nxt: 273 }; // 135
        detail = { pos: 184, len: 13, nxt: 273 }; // 178
        billedAmt = { pos: 285, len: 13, nxt: 273 }; // 299
        paidAmt = { pos: 299, len: 13, nxt: 273 }; // 299
        currentLength = 312;
        const lastProc = w.lastIndexOf("REV CD");
        const rem = w.substring(lastProc, w.length);
        while (rem.length > currentLength) {
          const srvCode = rem.substring(
            service.pos,
            service.pos + srvDateFrom.len
          );
          const modifier = rem.substring(
            modifierCd.pos,
            modifierCd.pos + modifierCd.len
          );
          const srvFrom = rem.substring(
            srvDateFrom.pos,
            srvDateFrom.pos + srvDateFrom.len
          );
          const srvTo = rem.substring(
            srvDateTo.pos,
            srvDateTo.pos + srvDateTo.len
          );
          const srvDetail = rem.substring(detail.pos, detail.pos + detail.len);
          const srvPaidAmt = rem.substring(
            paidAmt.pos,
            paidAmt.pos + paidAmt.len
          );

          const srvBilled = rem.substring(
            billedAmt.pos,
            billedAmt.pos + billedAmt.len
          );
          const srvDetailArray = srvDetail
            ? srvDetail.toString().split(" ")
            : [];
          const svInfo = [];
          if (srvDetailArray && srvDetailArray.length) {
            for (const sv of srvDetailArray) {
              const d = Constant.EOB_CODES.filter((f12) => f12.code === sv);
              if (d && d.length) {
                svInfo.push(`(${d[0].code}) ${d[0].desc}`);
              }
            }
          }
          const srvcDesc = Constant.SERVICE_CODES.filter(
            (s) => s.code === srvCode.replace(/^\s+|\s+$/g, "")
          );
          serviceInfo.push({
            name: cnt === 1 ? nameInfo : "-- same --",
            samename: nameInfo,
            srvcCode: srvCode.trim(),
            srvcDesc: srvcDesc && srvcDesc.length ? srvcDesc[0].desc : "",
            srvcFrom: srvFrom.replace(/ /g, ""),
            srvcTo: srvTo.replace(/ /g, ""),
            srvcDetail: srvDetail,
            srvcBilledAmt: srvBilled,
            srvcPaidAmt: srvPaidAmt,
            svDescription: svInfo,
            srvcModifierCd: modifier.trim(),
          });
          cnt += 1;
          currentLength = paidAmt.pos + paidAmt.nxt;
          service.pos += service.nxt;
          srvDateFrom.pos += srvDateFrom.nxt;
          srvDateTo.pos += srvDateTo.nxt;
          detail.pos += detail.nxt;
          modifierCd.pos += modifierCd.nxt;
          billedAmt.pos += billedAmt.nxt;
          paidAmt.pos += paidAmt.nxt;
        }
      }
    }
  }
  return serviceInfo;
};

exports.getServices = (data) => {
  const serviceList = [
    { name: "H2014", cnt: 0, desc: "" },
    { name: "H2017", cnt: 0, desc: "" },
    { name: "90837", cnt: 0, desc: "" },
    { name: "90839", cnt: 0, desc: "" },
    // { name: '90837 GT', cnt: 0,desc:'' },
    { name: "90876", cnt: 0, desc: "" },
    { name: "H0002", cnt: 0, desc: "" },
    { name: "H0004", cnt: 0, desc: "" },
    { name: "H0031", cnt: 0, desc: "" },
    { name: "90853", cnt: 0, desc: "" },
    { name: "90791", cnt: 0, desc: "" },
  ];
  let i = 0;
  let x = 0;
  let leftData = "";
  const l = data.length;
  while (i + x < l) {
    i = data.indexOf("PROC CD");
    if (i < 0) {
      break;
    }
    leftData = data.substring(i, data.length);
    x = leftData.indexOf("--ICN--");
    const report = data.substring(i, i + x);
    const words = report.split(" ");
    for (const w of words) {
      serviceList.forEach((s) => {
        if (s.name === w) {
          const servDesc = Constant.SERVICE_CODES.filter((f) => f.code === w);
          if (servDesc && servDesc.length) {
            s.desc = servDesc[0].desc;
          }
          s.cnt += 1;
        }
      });
    }
    data = data.substring(i + x + 1, data.length);
  }
  return { serviceList };
};

exports.getServicesV2 = (
  medicaidMemberClaimDeniedServiceInfo,
  medicareMemberClaimDeniedServiceInfo,
  medicaidMemberClaimPaidServiceInfo,
  medicareMemberClaimPaidServiceInfo
) => {
  const serviceList = [
    {
      name: "H2014",
      medicarePaid: 0,
      medicaidPaid: 0,
      medicareDenied: 0,
      medicaidDenied: 0,
      desc: "",
      total: 0,
    },
    {
      name: "H2017",
      medicarePaid: 0,
      medicaidPaid: 0,
      medicareDenied: 0,
      medicaidDenied: 0,
      desc: "",
      total: 0,
    },
    {
      name: "90837",
      medicarePaid: 0,
      medicaidPaid: 0,
      medicareDenied: 0,
      medicaidDenied: 0,
      desc: "",
      total: 0,
    },
    {
      name: "90839",
      medicarePaid: 0,
      medicaidPaid: 0,
      medicareDenied: 0,
      medicaidDenied: 0,
      desc: "",
      total: 0,
    },
    // { name: '90837 GT', cnt: 0,desc:'' },
    {
      name: "90876",
      medicarePaid: 0,
      medicaidPaid: 0,
      medicareDenied: 0,
      medicaidDenied: 0,
      desc: "",
      total: 0,
    },
    {
      name: "H0002",
      medicarePaid: 0,
      medicaidPaid: 0,
      medicareDenied: 0,
      medicaidDenied: 0,
      desc: "",
      total: 0,
    },
    {
      name: "H0004",
      medicarePaid: 0,
      medicaidPaid: 0,
      medicareDenied: 0,
      medicaidDenied: 0,
      desc: "",
      total: 0,
    },
    {
      name: "H0031",
      medicarePaid: 0,
      medicaidPaid: 0,
      medicareDenied: 0,
      medicaidDenied: 0,
      desc: "",
      total: 0,
    },
    {
      name: "90853",
      medicarePaid: 0,
      medicaidPaid: 0,
      medicareDenied: 0,
      medicaidDenied: 0,
      desc: "",
      total: 0,
    },
    {
      name: "90791",
      medicarePaid: 0,
      medicaidPaid: 0,
      medicareDenied: 0,
      medicaidDenied: 0,
      desc: "",
      total: 0,
    },
  ];

  serviceList.forEach((s) => {
    const servDesc = Constant.SERVICE_CODES.filter((f) => f.code === s.name);
    if (servDesc && servDesc.length) {
      s.desc = servDesc[0].desc;
    }
    const medicarePaidSrvc =
      medicareMemberClaimPaidServiceInfo &&
      medicareMemberClaimPaidServiceInfo.length &&
      medicareMemberClaimPaidServiceInfo.filter((m) => s.name === m.srvcCode);

    s.medicarePaid =
      medicarePaidSrvc && medicarePaidSrvc.length ? medicarePaidSrvc.length : 0;
    const medicaidPaidSrvc =
      medicaidMemberClaimPaidServiceInfo &&
      medicaidMemberClaimPaidServiceInfo.length &&
      medicaidMemberClaimPaidServiceInfo.filter((m) => s.name === m.srvcCode);
    s.medicaidPaid =
      medicaidPaidSrvc && medicaidPaidSrvc.length ? medicaidPaidSrvc.length : 0;
    const medicareDeniedSrvc =
      medicareMemberClaimDeniedServiceInfo &&
      medicareMemberClaimDeniedServiceInfo.length &&
      medicareMemberClaimDeniedServiceInfo.filter((m) => s.name === m.srvcCode);
    s.medicareDenied =
      medicareDeniedSrvc && medicareDeniedSrvc.length
        ? medicareDeniedSrvc.length
        : 0;
    const medicaidDeniedSrvc =
      medicaidMemberClaimDeniedServiceInfo &&
      medicaidMemberClaimDeniedServiceInfo.length &&
      medicaidMemberClaimDeniedServiceInfo.filter((m) => s.name === m.srvcCode);
    s.medicaidDenied =
      medicaidDeniedSrvc && medicaidDeniedSrvc.length
        ? medicaidDeniedSrvc.length
        : 0;
    s.total =
      s.medicarePaid + s.medicaidPaid + s.medicareDenied + s.medicaidDenied;
  });

  return { serviceList };
};

exports.capturePosition = (data, pos) => {
  let cnt = 1;
  // console.log('[data of array]', data);
  for (const d of data) {
    if (d.trim().length > 0) {
      //   console.log('[what is my data]', d, cnt, pos);
      if (cnt === pos) {
        return d;
      }
      cnt += 1;
      //   console.log('add counter', cnt);
    }
  }
  return "";
};
exports.captureAdjustment = () => {};
exports.captureReport = (data, reportName, endTag, cnt) => {
  console.log("[CNT]", cnt);
  const i =
    reportName !== "CLAIMS DENIED"
      ? data.indexOf(reportName)
      : data.indexOf("TOTAL CLAIMS PAYMENTS");
  const leftData = data.substring(i, data.length);
  let x = leftData.indexOf(endTag);
  // console.log('[endTag', endTag, x);
  if (endTag === "1REPORT:" && x !== -1) {
    x = leftData.indexOf("1REPORT:");
  } else if (leftData.indexOf("REPORT:") !== -1) {
    x = leftData.indexOf("REPORT:");
    // console.log('[found report instead', x)
  }
  const report = data.substring(i, i + x).replace(/\\n/g, "");
  // console.log('[report]', report);
  if (reportName === "TOTAL PROFESSIONAL SERVICE CLAIMS ADJ:") {
    if (i < 0) {
      return { amount: 0, totalCnt: 0 };
    }
    const totalAmountReported = report.replace(reportName, "");
    // console.log('[totalAmountReported', totalAmountReported);

    const amts = this.capturePosition(totalAmountReported.split(" "), 4);
    let totalCnt = totalAmountReported.indexOf("TOTAL NO. ADJ:");
    console.log(
      "[my total adj]",
      totalAmountReported.substring(totalCnt, totalAmountReported.length)
    );
    totalCnt = this.capturePosition(
      totalAmountReported
        .substring(totalCnt, totalAmountReported.length)
        .replace("TOTAL NO. ADJ:", "")
        .split(" "),
      1
    );
    return { amount: amts, totalCnt };
  }
  if (reportName === "TOTAL NO. ADJ:") {
    if (i < 0) {
      return { amount: 0, totalCnt: 0 };
    }
    const totalAmountReported = report.replace(reportName, "");
    // console.log('[totalAmountReported', totalAmountReported);

    const amts = this.capturePosition(totalAmountReported.split(" "), 1);
    let totalCnt = totalAmountReported.indexOf("TOTAL NO. ADJ:");
    totalCnt = this.capturePosition(
      totalAmountReported
        .substring(totalCnt, totalAmountReported.length)
        .replace("TOTAL NO. ADJ:", "")
        .split(" "),
      1
    );
    return { amount: amts, totalCnt };
  }
  if (reportName === "TOTAL PROFESSIONAL SERVICE CLAIMS DENIED:") {
    // console.log('[report', report);
    if (i < 0) {
      return { amount: 0, totalCnt: 0 };
    }
    const totalAmountReported = report.replace(reportName, "");
    // console.log('[totalAmountReported', totalAmountReported);

    const amts = this.capturePosition(totalAmountReported.split(" "), 1);
    let totalCnt = totalAmountReported.indexOf("TOTAL NO. DENIED:");
    totalCnt = this.capturePosition(
      totalAmountReported
        .substring(totalCnt, totalAmountReported.length)
        .replace("TOTAL NO. DENIED:", "")
        .split(" "),
      1
    );
    return { amount: amts, totalCnt };
  }
  if (
    reportName ===
    "TOTAL MEDICARE CROSSOVER PROFESSIONAL SERVICE CLAIMS DENIED:"
  ) {
    if (i < 0) {
      return { amount: 0, totalCnt: 0 };
    }
    const totalAmountReported = report.replace(reportName, "");
    // console.log('[TOTAL MEDICARE CROSSOVER PROFESSIONAL SERVICE CLAIMS DENIED:]', totalAmountReported);
    const amts = this.capturePosition(totalAmountReported.split(" "), 9);
    let totalCnt = totalAmountReported.indexOf("TOTAL NO. DENIED:");
    totalCnt = this.capturePosition(
      totalAmountReported
        .substring(totalCnt, totalAmountReported.length)
        .replace("TOTAL NO. DENIED:", "")
        .split(" "),
      1
    );
    // console.log('totalCnt]', totalCnt);
    return { amount: amts, totalCnt };
  }
  if (
    reportName === "TOTAL MEDICARE CROSSOVER PROFESSIONAL SERVICE CLAIMS PAID:"
  ) {
    if (i < 0) {
      return { amount: 0, totalCnt: 0 };
    }
    const totalAmountReported = report.replace(reportName, "");
    // console.log('[TOTAL PAID]', totalAmountReported);
    const amts = this.capturePosition(totalAmountReported.split(" "), 7);
    let totalCnt = totalAmountReported.indexOf("TOTAL NO. PAID:");
    totalCnt = this.capturePosition(
      totalAmountReported
        .substring(totalCnt, totalAmountReported.length)
        .replace("TOTAL NO. PAID:", "")
        .split(" "),
      1
    );
    // console.log('amt', amts, totalCnt);

    return { amount: amts, totalCnt };
  }
  if (reportName === "TOTAL PROFESSIONAL SERVICE CLAIMS PAID:") {
    const totalAmountReported = report.replace(reportName, "");
    const amts = this.capturePosition(totalAmountReported.split(" "), 4);
    let totalCnt = totalAmountReported.indexOf("TOTAL NO. PAID:");
    totalCnt = this.capturePosition(
      totalAmountReported
        .substring(totalCnt, totalAmountReported.length)
        .replace("TOTAL NO. PAID:", "")
        .split(" "),
      1
    );
    return { amount: amts, totalCnt };
  }
  if (reportName === "NET PAYMENT") {
    const totalAmountReported = report.replace(reportName, "");
    const amts = this.capturePosition(totalAmountReported.split(" "), 1);
    return { amount: amts };
  }
  if (reportName === "TOTAL CLAIMS PAYMENTS") {
    const totalAmountReported = report.replace(reportName, "");
    const amts = this.capturePosition(totalAmountReported.split(" "), 1);
    return { totalCnt: amts };
  }
  if (reportName === "CLAIMS DENIED") {
    const deniedEndTag = report.indexOf("CLAIMS DENIED");
    const newReport = report.substring(
      deniedEndTag,
      report.indexOf("CLAIMS IN PROCESS")
    );
    const amts = this.capturePosition(
      newReport.replace("CLAIMS DENIED", "").split(" "),
      1
    );
    return { totalCnt: amts };
  }
  return { amount: 0, totalCnt: 0 };
};
