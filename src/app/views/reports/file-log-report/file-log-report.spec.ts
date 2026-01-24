import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileLogReport } from './file-log-report';

describe('FileLogReport', () => {
  let component: FileLogReport;
  let fixture: ComponentFixture<FileLogReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileLogReport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileLogReport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
