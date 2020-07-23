import { useState, useEffect } from "react";
import { useCamera } from "@ionic/react-hooks/camera";
import { useFilesystem, base64FromPath } from "@ionic/react-hooks/filesystem";
import { useStorage } from "@ionic/react-hooks/storage";
import { isPlatform } from "@ionic/react";
import {
  CameraResultType,
  CameraSource,
  CameraPhoto,
  Capacitor,
  FilesystemDirectory,
} from "@capacitor/core";

export interface Photo {
  filepath: string;
  webviewPath?: string;
  base64?: string;
}
const PHOTO_STORAGE = "photos";

export function usePhotoGallery() {
  const { get, set } = useStorage();
  const { deleteFile, getUri, readFile, writeFile } = useFilesystem();
  const savePicture = async (
    photo: CameraPhoto,
    fileName: string
  ): Promise<Photo> => {
    let base64Data: string;
    if (isPlatform("hybrid")) {
      const file = await readFile({
        path: photo.path!,
      });
      base64Data = file.data;
    } else {
      base64Data = await base64FromPath(photo.webPath!);
    }

    // const base64Data = await base64FromPath(photo.webPath!);
    const savedFile = await writeFile({
      path: fileName,
      data: base64Data,
      directory: FilesystemDirectory.Data,
    });
    if (isPlatform("hybrid")) {
      return {
        filepath: fileName,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri),
      };
    } else {
      return {
        filepath: fileName,
        webviewPath: photo.webPath,
      };
    }
  };
  const { getPhoto } = useCamera();
  const [photos, setPhotos] = useState<Photo[]>([]);
  useEffect(() => {
    const loadSaved = async () => {
      const photosString = await get("photos");
      const photosInStorage = (photosString
        ? JSON.parse(photosString)
        : []) as Photo[];
      if (!isPlatform("hybrid")) {
        for (let photo of photos) {
          const file = await readFile({
            path: photo.filepath,
            directory: FilesystemDirectory.Data,
          });
          photo.base64 = `data:image/jpeg;base64,${file.data}`;
        }
      }

      setPhotos(photos);
    };
    loadSaved();
  }, [get, readFile]);

  const takePhoto = async () => {
    const cameraPhoto = await getPhoto({
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      quality: 100,
    });
    const fileName = new Date().getTime() + ".jpeg";
    const savedFileImage = await savePicture(cameraPhoto, fileName);
    const newPhotos = [savedFileImage, ...photos];
    setPhotos(newPhotos);
    set(
      PHOTO_STORAGE,
      isPlatform('hybrid')
      ? JSON.stringify(newPhotos)
      :JSON.stringify(
        newPhotos.map((newPhoto) => {
          const photoCopy = { ...newPhoto };
          delete photoCopy.base64;
          return photoCopy;
        })
      )
    );
  };
  const deletePhoto = async (photo: Photo) => {

    const newPhotos = photos.filter(p => p.filepath !== photo.filepath);

    set(PHOTO_STORAGE, JSON.stringify(newPhotos));

    const filename = photo.filepath.substr(photo.filepath.lastIndexOf('/') + 1);
    await deleteFile({
      path: filename,
      directory: FilesystemDirectory.Data
    });
    setPhotos(newPhotos);
  };
  return {
    photos,
    takePhoto,
    deletePhoto
  };
}
