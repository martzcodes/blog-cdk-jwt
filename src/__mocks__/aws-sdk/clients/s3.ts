export const mockS3Response = jest.fn().mockReturnValue(new Promise((resolve) => resolve(true)));

const mockPutObject = jest.fn().mockImplementation(() => ({ promise: mockS3Response }));

export default class S3 {
  putObject = mockPutObject;
}