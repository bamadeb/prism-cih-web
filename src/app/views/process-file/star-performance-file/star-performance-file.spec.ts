import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StarPerformanceFile } from './star-performance-file';

describe('StarPerformanceFile', () => {
  let component: StarPerformanceFile;
  let fixture: ComponentFixture<StarPerformanceFile>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StarPerformanceFile]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StarPerformanceFile);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
