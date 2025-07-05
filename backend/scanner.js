const fs = require("fs").promises;
const path = require("path");

class FileScanner {
  constructor(socket) {
    this.socket = socket;
    this.baseFiles = new Map(); // 기준 폴더 파일 정보 저장
    this.duplicates = []; // 중복 파일 목록
  }

  // 폴더 재귀적 스캔
  async scanFolder(folderPath, isBaseFolder = false) {
    try {
      const files = [];
      let totalFiles = 0;
      let scannedFiles = 0;

      // 먼저 전체 파일 수 계산
      await this.countFiles(folderPath);
      totalFiles = this.fileCount;

      // 실제 스캔 시작
      await this.scanDirectory(
        folderPath,
        files,
        isBaseFolder,
        totalFiles,
        scannedFiles
      );

      return files;
    } catch (error) {
      console.error("폴더 스캔 중 오류:", error);
      throw error;
    }
  }

  // 전체 파일 수 계산
  async countFiles(dirPath) {
    this.fileCount = 0;
    await this.countFilesRecursive(dirPath);
  }

  async countFilesRecursive(dirPath) {
    try {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          await this.countFilesRecursive(fullPath);
        } else {
          this.fileCount++;
        }
      }
    } catch (error) {
      console.error(`파일 수 계산 중 오류 (${dirPath}):`, error);
    }
  }

  // 디렉토리 재귀적 스캔
  async scanDirectory(dirPath, files, isBaseFolder, totalFiles, scannedFiles) {
    try {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);

        try {
          const stat = await fs.stat(fullPath);

          if (stat.isDirectory()) {
            // 진행상황 업데이트
            this.socket.emit("scan-progress", {
              percent: Math.round((scannedFiles / totalFiles) * 100),
              message: `폴더 스캔 중... (${scannedFiles}/${totalFiles})`,
              currentPath: fullPath,
              fileCount: scannedFiles,
            });

            await this.scanDirectory(
              fullPath,
              files,
              isBaseFolder,
              totalFiles,
              scannedFiles
            );
          } else {
            // 파일 정보 저장
            const fileInfo = {
              name: item,
              size: stat.size,
              path: fullPath,
            };

            files.push(fileInfo);
            scannedFiles++;

            // 기준 폴더인 경우 Map에 저장
            if (isBaseFolder) {
              const key = `${item}_${stat.size}`;
              this.baseFiles.set(key, fileInfo);
            }

            // 진행상황 업데이트 (100개마다)
            if (scannedFiles % 100 === 0) {
              this.socket.emit("scan-progress", {
                percent: Math.round((scannedFiles / totalFiles) * 100),
                message: `파일 스캔 중... (${scannedFiles}/${totalFiles})`,
                currentPath: fullPath,
                fileCount: scannedFiles,
              });
            }
          }
        } catch (error) {
          console.error(`파일/폴더 접근 오류 (${fullPath}):`, error);
        }
      }
    } catch (error) {
      console.error(`디렉토리 읽기 오류 (${dirPath}):`, error);
    }
  }

  // 중복 파일 찾기
  findDuplicates(compareFiles) {
    this.duplicates = [];

    for (const file of compareFiles) {
      const key = `${file.name}_${file.size}`;
      if (this.baseFiles.has(key)) {
        this.duplicates.push(file);
      }
    }

    return this.duplicates;
  }

  // 중복 파일 삭제
  async deleteDuplicates(duplicates) {
    const results = [];

    for (const file of duplicates) {
      try {
        await fs.unlink(file.path);
        results.push({
          success: true,
          path: file.path,
          message: "삭제 완료",
        });
      } catch (error) {
        results.push({
          success: false,
          path: file.path,
          message: error.message,
        });
      }
    }

    return results;
  }
}

module.exports = FileScanner;
