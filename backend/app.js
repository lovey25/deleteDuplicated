const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const FileScanner = require("./scanner");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, "../public")));

// Socket.IO 연결
io.on("connection", (socket) => {
  console.log("클라이언트 연결됨:", socket.id);

  let scanner = new FileScanner(socket);

  // 기준 폴더 스캔
  socket.on("scan-base-folder", async (data) => {
    try {
      console.log("기준 폴더 스캔 시작:", data.path);

      const files = await scanner.scanFolder(data.path, true);

      socket.emit("base-scan-complete", {
        fileCount: files.length,
        message: "기준 폴더 스캔이 완료되었습니다.",
      });

      console.log(`기준 폴더 스캔 완료: ${files.length}개 파일 발견`);
    } catch (error) {
      console.error("기준 폴더 스캔 오류:", error);
      socket.emit("scan-error", {
        message: `스캔 중 오류가 발생했습니다: ${error.message}`,
      });
    }
  });

  // 비교 폴더 스캔
  socket.on("scan-compare-folder", async (data) => {
    try {
      console.log("비교 폴더 스캔 시작:", data.path);

      const files = await scanner.scanFolder(data.path, false);
      const duplicates = scanner.findDuplicates(files);

      socket.emit("compare-scan-complete", {
        fileCount: files.length,
        duplicateCount: duplicates.length,
        duplicates: duplicates,
        message: "비교 폴더 스캔이 완료되었습니다.",
      });

      console.log(
        `비교 폴더 스캔 완료: ${files.length}개 파일 중 ${duplicates.length}개 중복 발견`
      );
    } catch (error) {
      console.error("비교 폴더 스캔 오류:", error);
      socket.emit("scan-error", {
        message: `스캔 중 오류가 발생했습니다: ${error.message}`,
      });
    }
  });

  // 중복 파일 삭제
  socket.on("delete-duplicates", async (data) => {
    try {
      console.log("중복 파일 삭제 시작:", data.duplicates.length, "개");

      const results = await scanner.deleteDuplicates(data.duplicates);
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      socket.emit("delete-complete", {
        total: data.duplicates.length,
        success: successCount,
        failed: failCount,
        results: results,
      });

      console.log(`삭제 완료: ${successCount}개 성공, ${failCount}개 실패`);
    } catch (error) {
      console.error("파일 삭제 오류:", error);
      socket.emit("delete-error", {
        message: `삭제 중 오류가 발생했습니다: ${error.message}`,
      });
    }
  });

  // 연결 해제
  socket.on("disconnect", () => {
    console.log("클라이언트 연결 해제:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
