const socket = io();

// DOM 요소들
const baseFolderInput = document.getElementById("baseFolder");
const compareFolderInput = document.getElementById("compareFolder");
const selectBaseBtn = document.getElementById("selectBaseBtn");
const selectCompareBtn = document.getElementById("selectCompareBtn");
const scanBaseBtn = document.getElementById("scanBaseBtn");
const scanCompareBtn = document.getElementById("scanCompareBtn");
const progressSection = document.querySelector(".progress-section");
const progressFill = document.querySelector(".progress-fill");
const progressText = document.getElementById("progressText");
const currentPath = document.getElementById("currentPath");
const fileCount = document.getElementById("fileCount");
const resultsSection = document.querySelector(".results-section");
const duplicateList = document.getElementById("duplicateList");
const deleteBtn = document.getElementById("deleteBtn");

// 기준 폴더 선택 버튼 클릭
selectBaseBtn.addEventListener("click", () => {
  const path = prompt(
    "기준 폴더의 전체 경로를 입력해주세요.\n\n예시:\n- macOS: /Users/username/Documents\n- Windows: C:\\Users\\username\\Documents\n- Linux: /home/username/documents"
  );
  if (path && path.trim()) {
    baseFolderInput.value = path.trim();
    console.log("Base folder path set to:", path.trim());
  }
});

// 비교 폴더 선택 버튼 클릭
selectCompareBtn.addEventListener("click", () => {
  const path = prompt(
    "비교 폴더의 전체 경로를 입력해주세요.\n\n예시:\n- macOS: /Users/username/Downloads\n- Windows: C:\\Users\\username\\Downloads\n- Linux: /home/username/downloads"
  );
  if (path && path.trim()) {
    compareFolderInput.value = path.trim();
    console.log("Compare folder path set to:", path.trim());
  }
});

// 기준 폴더 스캔 버튼 클릭
scanBaseBtn.addEventListener("click", () => {
  const folderPath = baseFolderInput.value.trim();
  if (!folderPath) {
    alert("기준 폴더를 선택해주세요.");
    return;
  }

  showProgress();
  socket.emit("scan-base-folder", { path: folderPath });
});

// 비교 폴더 스캔 버튼 클릭
scanCompareBtn.addEventListener("click", () => {
  const folderPath = compareFolderInput.value.trim();
  if (!folderPath) {
    alert("비교 폴더를 선택해주세요.");
    return;
  }

  showProgress();
  socket.emit("scan-compare-folder", { path: folderPath });
});

// 진행상황 표시
function showProgress() {
  progressSection.style.display = "block";
  resultsSection.style.display = "none";
  updateProgress(0, "스캔 준비 중...");
}

// 진행상황 업데이트
function updateProgress(percent, text) {
  progressFill.style.width = `${percent}%`;
  progressText.textContent = text;
}

// Socket.IO 이벤트 리스너들
socket.on("scan-progress", (data) => {
  updateProgress(data.percent, data.message);
  currentPath.textContent = `현재 폴더: ${data.currentPath || "-"}`;
  fileCount.textContent = `발견된 파일: ${data.fileCount || 0}개`;
});

socket.on("base-scan-complete", (data) => {
  updateProgress(100, "기준 폴더 스캔 완료!");
  setTimeout(() => {
    progressSection.style.display = "none";
    compareFolderInput.disabled = false;
    selectCompareBtn.disabled = false;
    scanCompareBtn.disabled = false;
    alert(`기준 폴더 스캔 완료! ${data.fileCount}개의 파일을 발견했습니다.`);
  }, 1000);
});

socket.on("compare-scan-complete", (data) => {
  updateProgress(100, "비교 폴더 스캔 완료!");
  setTimeout(() => {
    progressSection.style.display = "none";
    showResults(data.duplicates);
  }, 1000);
});

socket.on("delete-complete", (data) => {
  alert(
    `삭제 완료!\n총 ${data.total}개 중 ${data.success}개 성공, ${data.failed}개 실패`
  );

  // 실패한 파일이 있다면 결과 표시
  if (data.failed > 0) {
    const failedFiles = data.results.filter((r) => !r.success);
    let message = "삭제 실패한 파일들:\n";
    failedFiles.forEach((file) => {
      message += `- ${file.path}: ${file.message}\n`;
    });
    alert(message);
  }
});

socket.on("scan-error", (data) => {
  alert(`스캔 오류: ${data.message}`);
  progressSection.style.display = "none";
});

socket.on("delete-error", (data) => {
  alert(`삭제 오류: ${data.message}`);
});

// 결과 표시
function showResults(duplicates) {
  resultsSection.style.display = "block";

  if (duplicates.length === 0) {
    duplicateList.innerHTML = "<p>중복 파일이 발견되지 않았습니다.</p>";
    return;
  }

  let html = '<table style="width: 100%; border-collapse: collapse;">';
  html +=
    '<tr><th style="border: 1px solid #ddd; padding: 8px; background: #f8f9fa;">파일명</th>';
  html +=
    '<th style="border: 1px solid #ddd; padding: 8px; background: #f8f9fa;">크기</th>';
  html +=
    '<th style="border: 1px solid #ddd; padding: 8px; background: #f8f9fa;">경로</th></tr>';

  duplicates.forEach((file) => {
    html += `<tr>
      <td style="border: 1px solid #ddd; padding: 8px;">${file.name}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${formatFileSize(
        file.size
      )}</td>
      <td style="border: 1px solid #ddd; padding: 8px;">${file.path}</td>
    </tr>`;
  });

  html += "</table>";
  duplicateList.innerHTML = html;

  deleteBtn.style.display = "inline-block";
  deleteBtn.onclick = () => {
    if (
      confirm(`정말로 ${duplicates.length}개의 중복 파일을 삭제하시겠습니까?`)
    ) {
      socket.emit("delete-duplicates", { duplicates });
    }
  };
}

// 파일 크기 포맷팅
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

console.log("Socket.IO 클라이언트 연결됨");
// 추후 폴더 입력, 진행상황 표시, 결과 처리 등 구현 예정
