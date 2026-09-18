import { Test, TestingModule } from '@nestjs/testing';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';

describe('LinksController', () => {
  let controller: LinksController;
  let serviceMock: {
    createLink: jest.Mock;
    accessLink: jest.Mock;
  };

  beforeEach(async () => {
    serviceMock = {
      createLink: jest.fn(),
      accessLink: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LinksController],
      providers: [
        {
          provide: LinksService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<LinksController>(LinksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call createLink on LinksService', async () => {
    const dto = {
      message: 'Hello secret',
      expiresIn: 3600,
    };
    const expected = {
      code: 'abc12345',
      expiresAt: new Date(),
    };

    serviceMock.createLink.mockResolvedValue(expected);

    const result = await controller.createLink(dto);
    expect(result).toEqual(expected);
    expect(serviceMock.createLink).toHaveBeenCalledWith(dto);
  });

  it('should call accessLink for public links', async () => {
    serviceMock.accessLink.mockResolvedValue({ message: 'Hello secret' });

    const result = await controller.getLinkByShortCode('code123');
    expect(result).toEqual({ message: 'Hello secret' });
    expect(serviceMock.accessLink).toHaveBeenCalledWith('code123');
  });

  it('should call accessLink with password for protected links', async () => {
    serviceMock.accessLink.mockResolvedValue({ message: 'Protected secret' });

    const result = await controller.accessLink('code123', {
      password: 'mypassword',
    });
    expect(result).toEqual({ message: 'Protected secret' });
    expect(serviceMock.accessLink).toHaveBeenCalledWith('code123', 'mypassword');
  });
});
